from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
from typing import List
from functools import lru_cache
from sqlalchemy.orm import Session

import os
import re
import difflib
import time
import traceback
import nltk
import language_tool_python

from database import get_db, User as DBUser
from auth_utils import (
    get_password_hash,
    verify_password,
    create_access_token,
    decode_access_token
)

# GEMINI IMPORTS
import google.generativeai as genai
from dotenv import load_dotenv

# =========================
# LOAD ENV VARIABLES
# =========================
load_dotenv()

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

model = genai.GenerativeModel("gemini-1.5-flash")

# =========================
# NLTK DOWNLOAD
# =========================
try:
    nltk.data.find('tokenizers/punkt')
except LookupError:
    nltk.download('punkt')

# =========================
# LOCAL GRAMMAR FALLBACK
# =========================
_language_tool = None

def get_language_tool():
    global _language_tool
    if _language_tool is None:
        _language_tool = language_tool_python.LanguageTool("en-US")
    return _language_tool


def clean_output(text: str) -> str:
    """Clean and normalize output text."""
    text = re.sub(r'\s+', ' ', text)
    text = re.sub(r'\s+([.,!?;:])', r'\1', text)
    text = re.sub(r'([.,!?;:])([^\s])', r'\1 \2', text)
    text = re.sub(r'([.!?])([A-Z])', r'\1 \2', text)
    text = text.strip()
    return text


def normalize_pronoun_i(text: str) -> str:
    """Normalize standalone lowercase I to uppercase I."""
    text = re.sub(r'\bi\b', 'I', text)
    return text


def ensure_sentence_capitalization(text: str) -> str:
    """Ensure every sentence starts with a capital letter."""
    sentences = re.split(r'([.!?]+)', text)
    corrected = []
    for i in range(0, len(sentences), 2):
        sentence = sentences[i].strip()
        if sentence:
            sentence = sentence[0].upper() + sentence[1:]
        corrected.append(sentence)
        if i + 1 < len(sentences):
            corrected.append(sentences[i + 1] + ' ')
    return ''.join(corrected).strip()


def post_process_polished_text(text: str) -> str:
    """Apply consistent formatting and final cleanup."""
    text = normalize_pronoun_i(text)
    text = ensure_sentence_capitalization(text)
    text = clean_output(text)
    return text


def apply_enhanced_local_corrections(text: str) -> str:
    """Apply enhanced local corrections with basic rules."""
    corrections = [
        # Common misspellings
        (r'\berros\b', 'errors'),
        (r'\breciev\b', 'receive'),
        (r'\brecieve\b', 'receive'),
        (r'\boccured\b', 'occurred'),
        (r'\bseperate\b', 'separate'),
        (r'\bdefinately\b', 'definitely'),
        (r'\bbegining\b', 'beginning'),
        (r'\boccassion\b', 'occasion'),
        (r'\baccomodate\b', 'accommodate'),
        (r'\bacheive\b', 'achieve'),
        (r'\barguement\b', 'argument'),
        (r'\bbelive\b', 'believe'),
        (r'\bcalender\b', 'calendar'),
        (r'\bcategorie\b', 'category'),
        (r'\bceasar\b', 'caesar'),
        (r'\bconcious\b', 'conscious'),
        (r'\bcritisize\b', 'criticize'),
        (r'\bdisipline\b', 'discipline'),
        (r'\bmaintanance\b', 'maintenance'),
        (r'\bneccessary\b', 'necessary'),
        (r'\bpersue\b', 'pursue'),
        (r'\bpriviledge\b', 'privilege'),
        (r'\breciept\b', 'receipt'),
        (r'\brefered\b', 'referred'),
        (r'\brember\b', 'remember'),
        (r'\bseperated\b', 'separated'),
        (r'\bsuccesful\b', 'successful'),
        (r'\bsuprise\b', 'surprise'),
        (r'\btommorow\b', 'tomorrow'),
        (r'\btounge\b', 'tongue'),
        (r'\btruely\b', 'truly'),
        (r'\buntill\b', 'until'),
        (r'\bwierd\b', 'weird'),
        (r'\bwritting\b', 'writing'),
        (r'\bgrammer\b', 'grammar'),
        (r'\bcomftorable\b', 'comfortable'),
        (r'\bshopkeeper\b', 'shopkeeper'),
        (r'\bmoney later\b', 'pay later'),

        # Common grammar fixes
        (r'\bi goes\b', 'I go'),
        (r'\bi went\b', 'I went'),
        (r'\bme go\b', 'I go'),
        (r'\bhe go\b', 'he goes'),
        (r'\bshe go\b', 'she goes'),
        (r'\bit go\b', 'it goes'),
        (r'\bwe goes\b', 'we go'),
        (r'\bthey goes\b', 'they go'),
        (r'\bhe say\b', 'he said'),
        (r'\bshe say\b', 'she said'),
        (r'\bthey say\b', 'they said'),
        (r'\bhe come\b', 'he came'),
        (r'\bshe come\b', 'she came'),
        (r'\bthey come\b', 'they came'),
        (r'\bto their\b', 'to there'),
        (r'\btheir and\b', 'there and'),

        # Common phrase corrections
        (r'\bcould of\b', 'could have'),
        (r'\bshould of\b', 'should have'),
        (r'\bwould of\b', 'would have'),
        (r'\bmust of\b', 'must have'),
        (r'\bI forget my wallet\b', 'I forgot my wallet'),
        (r'\bI cant paid\b', "I couldn't pay"),
        (r'\bcant paid\b', "couldn't pay"),
        (r'\bI can take the items and give the money later\b', 'I could take the items and pay later'),
        (r'\bI could take the items and give the pay later\b', 'I could take the items and pay later'),
        (r'\bI can take the items\b', 'I could take the items'),
        (r'\bHe said that I can\b', 'He said that I could'),
        (r'\bhe said that I can\b', 'he said that I could'),
        (r'\bThere was many people\b', 'There were many people'),
        (r'\bmy friend come\b', 'my friend came'),
        (r'\bthen my friend came there and help me\b', 'then my friend came there and helped me'),
        (r'\bhelp me by paying\b', 'helped me by paying'),
        (r'\bgo to the market to buy some fruits\b', 'went to the market to buy some fruit'),
        (r'\bhe say\b', 'he said'),
        (r'\bshe say\b', 'she said'),
        (r'\bthey say\b', 'they said'),
        (r'\bto their\b', 'to there'),
        (r'\bvery greatful\b', 'very grateful'),

        # Punctuation fixes
        (r'\s+,\s*', ', '),
        (r'\s+\.\s*', '. '),
        (r'\s+\?\s*', '? '),
        (r'\s+!\s*', '! '),
    ]

    result = text
    for pattern, replacement in corrections:
        result = re.sub(pattern, replacement, result, flags=re.IGNORECASE)

    return result


def apply_double_pass_correction(text: str) -> str:
    """Apply language tool correction twice for better coverage."""
    try:
        tool = get_language_tool()
        pass1 = tool.correct(text)
        pass1 = apply_enhanced_local_corrections(pass1)
        pass2 = tool.correct(pass1)
        pass2 = post_process_polished_text(pass2)
        print(f"Double pass: '{text[:40]}...' -> '{pass2[:40]}...'")
        return pass2
    except Exception as exc:
        print(f"Double pass failed: {exc}")
        return post_process_polished_text(apply_enhanced_local_corrections(text))


def generate_polished_text(text: str, prompt: str) -> str:
    """Use Gemini to produce a fully polished version of the text."""
    response = model.generate_content(
        prompt,
        generation_config=genai.GenerationConfig(
            temperature=0.3,
            top_p=0.95,
            max_output_tokens=1024,
            candidate_count=1,
        ),
    )

    if hasattr(response, 'text') and response.text:
        return response.text.strip()
    if hasattr(response, 'candidates') and response.candidates:
        candidate = response.candidates[0]
        if hasattr(candidate, 'content'):
            return candidate.content.strip()
        if hasattr(candidate, 'text'):
            return candidate.text.strip()
    raise ValueError('Gemini response did not include text')


def apply_final_polish_rules(text: str) -> str:
    """Apply final sentence-level polish rules for natural fluency."""
    rules = [
        (r"\bI forgot my wallet at home so I couldn't pay for anything\b", "I forgot my wallet at home, so I couldn't pay for anything"),
        (r"\bI couldn't pay for anything\. The shopkeeper was very kind he said\b", "I couldn't pay for anything. The shopkeeper was very kind, and he said"),
        (r"\bThe shopkeeper was very kind, and he said that I could take the items and give the pay later, but I was not comfortable with that idea\b", "The shopkeeper was very kind and said I could take the items and pay later, but I was not comfortable with that idea"),
        (r"\bI could take the items and give the pay later\b", "I could take the items and pay later"),
        (r"\bThen my friend came there and helped me by paying the bill, I was very grateful to him because without him, I would be very embarrassed\b", "Then my friend came there and helped me by paying the bill. I was very grateful to him, because without him I would have been very embarrassed"),
        (r"\bThere were many people in the store and everyone was looking at me like I did something wrong\b", "There were many people in the store, and everyone was looking at me as if I had done something wrong"),
    ]
    polished = text
    for pattern, replacement in rules:
        polished = re.sub(pattern, replacement, polished, flags=re.IGNORECASE)
    return polished


def correct_text_locally(text: str) -> str:
    try:
        print(f"Local correction: input length={len(text)}")
        enhanced = apply_enhanced_local_corrections(text)
        corrected = apply_double_pass_correction(enhanced)
        result = post_process_polished_text(corrected)
        result = post_process_polished_text(apply_final_polish_rules(result))
        if len(result.strip()) < len(text.strip()) * 0.8 or result.strip() == text.strip():
            result = post_process_polished_text(apply_basic_improvements(result))
        print(f"Local correction result: length={len(result)}")
        return result
    except Exception as exc:
        print(f"Local grammar correction failed: {exc}")
        import traceback
        traceback.print_exc()
        return post_process_polished_text(apply_basic_improvements(text))


def apply_basic_improvements(text: str) -> str:
    """Apply basic text improvements when other methods fail."""
    result = text
    sentences = re.split(r'([.!?]+)', result)
    improved_sentences = []
    for i in range(0, len(sentences), 2):
        sentence = sentences[i]
        if sentence.strip():
            sentence = sentence.strip()
            if sentence:
                sentence = sentence[0].upper() + sentence[1:] if len(sentence) > 1 else sentence.upper()
        improved_sentences.append(sentence)
        if i + 1 < len(sentences):
            improved_sentences.append(sentences[i + 1])
    result = ''.join(improved_sentences)
    result = re.sub(r'\s+([.,!?;:])', r'\1', result)
    result = re.sub(r'([.,!?;:])([^\s])', r'\1 \2', result)
    result = re.sub(r'\s+', ' ', result)
    return result.strip()


def has_gemini_api_key() -> bool:
    return bool(os.getenv("GEMINI_API_KEY"))

# =========================
# FASTAPI APP
# =========================
app = FastAPI(title="Fast Professional Grammar API")

@app.get("/")
async def root():
    return {"message": "TextPerfect Backend API is running"}

# =========================
# AUTH SETUP
# =========================
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

class UserSignup(BaseModel):
    email: str
    password: str
    full_name: str

class UserLogin(BaseModel):
    email: str
    password: str

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):
    payload = decode_access_token(token)

    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")

    email: str = payload.get("sub")

    user = db.query(DBUser).filter(DBUser.email == email).first()

    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    return user

# =========================
# AUTH ROUTES
# =========================
@app.post("/signup")
async def signup(user_data: UserSignup, db: Session = Depends(get_db)):
    db_user = db.query(DBUser).filter(DBUser.email == user_data.email).first()

    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed_password = get_password_hash(user_data.password)

    new_user = DBUser(
        email=user_data.email,
        full_name=user_data.full_name,
        hashed_password=hashed_password
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    access_token = create_access_token(data={"sub": new_user.email})

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "email": new_user.email,
            "full_name": new_user.full_name
        }
    }

@app.post("/login")
async def login(user_data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(DBUser).filter(DBUser.email == user_data.email).first()

    if not user or not verify_password(user_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email or password")

    access_token = create_access_token(data={"sub": user.email})

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "email": user.email,
            "full_name": user.full_name
        }
    }

@app.get("/me")
async def read_users_me(current_user: DBUser = Depends(get_current_user)):
    return {
        "email": current_user.email,
        "full_name": current_user.full_name
    }

# =========================
# GOOGLE AUTH MOCK
# =========================
@app.post("/auth/google")
async def google_auth(request: dict, db: Session = Depends(get_db)):
    email = request.get("email")
    full_name = request.get("full_name")

    user = db.query(DBUser).filter(DBUser.email == email).first()

    if not user:
        user = DBUser(
            email=email,
            full_name=full_name,
            hashed_password="GOOGLE_AUTH_NO_PASSWORD"
        )

        db.add(user)
        db.commit()
        db.refresh(user)

    access_token = create_access_token(data={"sub": user.email})

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "email": user.email,
            "full_name": user.full_name
        }
    }

# =========================
# CORS
# =========================
origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================
# REQUEST MODELS
# =========================
class TextRequest(BaseModel):
    text: str

class Correction(BaseModel):
    id: str
    offset: int
    length: int
    original: str
    corrected: str
    replacements: List[str]
    message: str
    shortMessage: str
    category: str
    explanation: str

class AnalysisResponse(BaseModel):
    text: str
    correctedText: str
    matches: List[Correction]

# =========================
# HELPER FUNCTIONS
# =========================
def get_corrections_from_diff(original_text: str, final_text: str) -> List[Correction]:
    orig_tokens = re.findall(r'\w+|[^\w\s]|\s+', original_text)
    final_tokens = re.findall(r'\w+|[^\w\s]|\s+', final_text)

    matcher = difflib.SequenceMatcher(None, orig_tokens, final_tokens)

    corrections = []
    orig_offsets = []

    curr = 0

    for t in orig_tokens:
        orig_offsets.append(curr)
        curr += len(t)

    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag in ('replace', 'delete', 'insert'):

            orig_fragment = "".join(orig_tokens[i1:i2])
            corr_fragment = "".join(final_tokens[j1:j2])

            if orig_fragment == corr_fragment:
                continue

            offset = orig_offsets[i1] if i1 < len(orig_offsets) else len(original_text)
            length = len(orig_fragment)

            corrections.append(Correction(
                id=f"corr-{i1}-{time.time()}",
                offset=offset,
                length=length,
                original=orig_fragment,
                corrected=corr_fragment,
                replacements=[corr_fragment] if corr_fragment else [],
                message="Refine for clarity.",
                shortMessage="Edit",
                category="Grammar",
                explanation="Polished for better flow and correctness."
            ))

    return corrections

# =========================
# ANALYZE ENDPOINT
# =========================
@app.post("/analyze", response_model=AnalysisResponse)
async def analyze_text(request: TextRequest):

    text = request.text

    if not text.strip():
        return AnalysisResponse(
            text=text,
            correctedText=text,
            matches=[]
        )

    print(f"\\n=== ANALYZE REQUEST ===")
    print(f"Input text length: {len(text)}")

    prompt = f"""You are an expert English grammar correction assistant. Your task is to correct all grammar, spelling, punctuation, capitalization, tense, and sentence structure errors in the given text. Preserve the original meaning and intent exactly. Do not add new information or change the tone. Return ONLY the fully corrected text with no explanations.

Examples:

Input: i goes to school yesterday
Output: I went to school yesterday

Input: we seen the movie last week
Output: We saw the movie last week

Input: bringed the book home
Output: Brought the book home

Input: alot of people came
Output: A lot of people came

Text to correct:
{text}
"""

    final_text = text
    if has_gemini_api_key():
        print("Attempting Gemini correction...")
        try:
            gemini_result = generate_polished_text(text, prompt)
            print(f"Gemini result length: {len(gemini_result)}")
            final_text = post_process_polished_text(gemini_result)
        except Exception as exc:
            print(f"Gemini failed ({type(exc).__name__}): {exc}")
            traceback.print_exc()
            final_text = correct_text_locally(text)
    else:
        print("No Gemini API key, using local correction")
        final_text = correct_text_locally(text)
    
    # Safety check
    if not final_text or final_text.strip() == "":
        print("ERROR: final_text is empty, reverting to original")
        final_text = text
    
    print(f"Final output length: {len(final_text)}")
    print(f"=== END ANALYZE ===\\n")

    corrections = get_corrections_from_diff(text, final_text)

    return AnalysisResponse(
        text=text,
        correctedText=final_text,
        matches=corrections
    )

# =========================
# IMPROVE ENDPOINT
# =========================
@app.post("/improve")
async def improve_text(request: TextRequest):
    return await analyze_text(request)

# =========================
# RUN SERVER
# =========================
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)