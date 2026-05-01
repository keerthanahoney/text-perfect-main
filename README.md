# TextPerfect - AI-Powered Autocorrect System

TextPerfect is a context-aware writing assistant that uses a transformer-based NLP model (T5) to correct grammar, spelling, and fluency issues in real-time.

## Features

- **Context-Aware Correction**: Detects verb tense errors, subject-verb agreement issues, and homophone mistakes.
- **T5 Transformer Model**: Powered by `vennify/t5-base-grammar-correction` for deep linguistic understanding.
- **Real-Time Editor**: Highlighting errors as you type with detailed explanation cards.
- **Premium UI**: Clean, professional design with support for dark mode.

## Tech Stack

- **Frontend**: React, Tailwind CSS, Shadcn UI
- **Backend**: FastAPI (Python)
- **NLP**: Hugging Face Transformers, NLTK

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js & npm

### Installation

1. **Backend**:
   ```bash
   cd backend
   pip install -r requirements.txt
   python main.py
   ```

2. **Frontend**:
   ```bash
   npm install
   npm run dev
   ```

## Development

The backend runs on `http://localhost:8000` and the frontend runs on `http://localhost:8080`.
