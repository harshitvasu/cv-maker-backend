# CV Maker AI Backend

Node.js / Express backend service handling all AI resume tailoring operations using Groq and xAI Grok APIs. Keeps secret keys secure server-side.

## Features

- **Secure Key Storage**: API keys (`GROQ_API_KEY` or `GROK_API_KEY`) reside exclusively on the server in `.env`.
- **Endpoints**:
  - `GET /api/health`: Health status check.
  - `GET /api/ai/status`: Reports whether an AI key is configured (never reveals the key string) and lists available models.
  - `GET /api/ai/models`: Returns list of supported models.
  - `POST /api/ai/tailor`: Executes resume tailoring in `jd` mode (target Job Description) or `prompt` mode (instruction-based modification).
- **Supported AI Models**:
  - `openai/gpt-oss-120b` (Default, Ultra-Fast High Quality)
  - `openai/gpt-oss-20b` (Lightweight & Fast)
  - `qwen/qwen3.8-27b` (Coding & Multilingual)
  - `grok-beta` (xAI Grok)
- **Automatic Section Preservation**: Guarantees all resume sections (`personalInfo`, `summary`, `skills`, `experiences`, `projects`, `education`, `settings`) are preserved even if an LLM response drops them.
- **Dynamic ATS Score**: Returns ATS match score calculated dynamically from candidate experience or keyword overlap.

## Setup & Running

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Configure Environment**:
   Copy `.env.example` to `.env` and set your key:
   ```bash
   cp .env.example .env
   ```
   Add your `GROQ_API_KEY` or `GROK_API_KEY`.

3. **Start the Server**:
   ```bash
   # Development with auto-reload:
   npm run dev

   # Production:
   npm start
   ```
   Server listens on port `5001` (or custom `PORT`).
