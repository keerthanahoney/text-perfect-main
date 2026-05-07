from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import torch
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
import nltk
from typing import List, Optional
import difflib
import time
import re
from functools import lru_cache
from sqlalchemy.orm import Session
from database import get_db, User as DBUser
from auth_utils import get_password_hash, verify_password, create_access_token, decode_access_token
from fastapi import Depends, Header
from fastapi.security import OAuth2PasswordBearer

# Download NLTK data
try:
    nltk.data.find('tokenizers/punkt')
except LookupError:
    nltk.download('punkt')
    nltk.download('punkt_tab')

app = FastAPI(title="Fast Professional Grammar API")

@app.get("/")
async def root():
    return {"message": "TextPerfect Backend API is running"}

# Authentication setup
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

class UserSignup(BaseModel):
    email: str
    password: str
    full_name: str

class UserLogin(BaseModel):
    email: str
    password: str

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    email: str = payload.get("sub")
    user = db.query(DBUser).filter(DBUser.email == email).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

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
    return {"access_token": access_token, "token_type": "bearer", "user": {"email": new_user.email, "full_name": new_user.full_name}}

@app.post("/login")
async def login(user_data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(DBUser).filter(DBUser.email == user_data.email).first()
    if not user or not verify_password(user_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    
    access_token = create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer", "user": {"email": user.email, "full_name": user.full_name}}

@app.get("/me")
async def read_users_me(current_user: DBUser = Depends(get_current_user)):
    return {"email": current_user.email, "full_name": current_user.full_name}

# Google Login Mock (for frontend integration)
@app.post("/auth/google")
async def google_auth(request: dict, db: Session = Depends(get_db)):
    # In a real app, verify the token with Google
    email = request.get("email")
    full_name = request.get("full_name")
    
    user = db.query(DBUser).filter(DBUser.email == email).first()
    if not user:
        # Create user on first Google login
        user = DBUser(email=email, full_name=full_name, hashed_password="GOOGLE_AUTH_NO_PASSWORD")
        db.add(user)
        db.commit()
        db.refresh(user)
    
    access_token = create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer", "user": {"email": user.email, "full_name": user.full_name}}

# Enable CORS
origins = ["*"] # Be more permissive for local dev speed

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global model and tokenizer
model = None
tokenizer = None
device = "cuda" if torch.cuda.is_available() else "cpu"

def load_model():
    global model, tokenizer
    try:
        print(f"Loading Optimized CoEdit model on {device}...")
        model_name = "jbochi/coedit-base"
        tokenizer = AutoTokenizer.from_pretrained(model_name)
        model = AutoModelForSeq2SeqLM.from_pretrained(model_name).to(device)
        if device == "cpu":
            # Optional: dynamic quantization for CPU speedup
            try:
                model = torch.quantization.quantize_dynamic(
                    model, {torch.nn.Linear}, dtype=torch.qint8
                )
                print("Applied dynamic quantization for CPU speedup.")
            except Exception as qe:
                print(f"Quantization skipped: {qe}")
        print("Model loaded successfully.")
    except Exception as e:
        print(f"Failed to load model: {e}")

@app.on_event("startup")
async def startup_event():
    load_model()

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

@lru_cache(maxsize=128)
def generate_edit_cached(input_text: str, instruction: str) -> str:
    """Cached helper to generate text using CoEdit instructions."""
    if model is None or tokenizer is None:
        return input_text
        
    full_input = f"{instruction}: {input_text}"
    input_ids = tokenizer(full_input, return_tensors="pt").input_ids.to(device)
    
    with torch.inference_mode():
        outputs = model.generate(
            input_ids,
            max_length=512,
            num_beams=1, # Greedy search for maximum speed
            do_sample=False
        )
    
    return tokenizer.decode(outputs[0], skip_special_tokens=True)

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
            if orig_fragment == corr_fragment: continue
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

@app.post("/analyze", response_model=AnalysisResponse)
async def analyze_text(request: TextRequest):
    if model is None: return AnalysisResponse(text=request.text, correctedText=request.text, matches=[])
    text = request.text
    if not text.strip(): return AnalysisResponse(text=text, correctedText=text, matches=[])
    
    # ONE PASS OPTIMIZATION: Combine Grammar + Fluency + Professional Tone
    # CoEdit is smart enough to handle composite instructions or general ones
    final_text = generate_edit_cached(text, "Fix grammatical errors and make this text more professional")
    
    all_corrections = get_corrections_from_diff(text, final_text)
    return AnalysisResponse(text=text, correctedText=final_text, matches=all_corrections)

@app.post("/improve")
async def improve_text(request: TextRequest):
    return await analyze_text(request)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
