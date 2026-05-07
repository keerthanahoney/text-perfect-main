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
    # Remove extra whitespace
    text = re.sub(r'\s+', ' ', text)
    # Fix spacing around punctuation
    text = re.sub(r'\s+([.,!?;:])', r'\1', text)
    text = re.sub(r'([.,!?;:])([^\s])', r'\1 \2', text)
    # Ensure proper spacing after sentences
    text = re.sub(r'([.!?])([A-Z])', r'\1 \2', text)
    # Remove leading/trailing whitespace
    text = text.strip()
    return text


def apply_double_pass_correction(text: str) -> str:
    """Apply language tool correction twice for better coverage."""
    try:
        tool = get_language_tool()
        pass1 = tool.correct(text)
        pass2 = tool.correct(pass1)
        print(f"Double pass: '{text[:40]}...' -> '{pass2[:40]}...'")
        return pass2
    except Exception as exc:
        print(f"Double pass failed: {exc}")
        return text


def correct_text_locally(text: str) -> str:
    try:
        print(f"Local correction: input length={len(text)}")
        corrected = apply_double_pass_correction(text)
        result = clean_output(corrected)
        print(f"Local correction result: length={len(result)}")
        return result
    except Exception as exc:
        print(f"Local grammar correction failed: {exc}")
        import traceback
        traceback.print_exc()
        return text


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

    prompt = f"""You are an expert English grammar and style editor. Your task is to polish the following text to be grammatically correct, fluent, and professional while preserving the original meaning and intent.

Focus on:
1. Grammar and syntax: Fix verb tenses, subject-verb agreement, misplaced modifiers, and sentence fragments.
2. Spelling and punctuation: Correct all spelling errors and ensure proper punctuation usage.
3. Clarity and flow: Remove redundancy, awkward phrasing, and robotic language. Make sentences flow naturally.
4. Tone: Keep a professional yet human tone. Avoid overly formal or stilted language.
5. Word choice: Use precise, natural words that fit the context.
6. Formatting: Clean up unnecessary whitespace and repetition.

Preserve the original meaning and intent. Do not add new information.

Text to polish:
{text}

Return ONLY the polished, corrected text."""

    final_text = text
    gemini_key = os.getenv("GEMINI_API_KEY")
    
    if gemini_key:
        print("Attempting Gemini correction...")
        try:
            response = model.generate_content(prompt)
            if hasattr(response, "text") and response.text:
                gemini_result = response.text.strip()
                print(f"Gemini result length: {len(gemini_result)}")
                # Apply local correction to polish Gemini result
                final_text = correct_text_locally(gemini_result)
            else:
                raise ValueError("Gemini response missing text field")
        except Exception as exc:
            print(f"Gemini failed ({type(exc).__name__}): {exc}")
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