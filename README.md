# Resume Generator

AI-powered resume tailoring with a full ATS score panel.

Upload your base resume + job description → get a tailored, keyword-matched resume with a 0–100 ATS score breakdown in seconds.

## Features

- **3-Step Wizard** — Upload resume → Paste JD → Review diffs + score + save
- **ATS Score Panel** — 6-factor scoring: contact info, required sections, keyword match, formatting, action verbs, quantified achievements
- **Keyword Matching** — Visual matched (green) vs missing (red) keyword chips
- **Diff-Based Tailoring** — Only rephrases what exists; never fabricates experience
- **Resume Builder** — Edit any section with live ATS score recalculation
- **PDF Export** — ATS-safe resume templates rendered via Playwright
- **Multi-LLM** — OpenAI, Anthropic, Gemini, OpenRouter, DeepSeek, Ollama

## Quick Start (Docker)

```bash
cd resume-gen
cp apps/backend/.env.example apps/backend/.env
# Edit .env with your LLM API key
docker compose up
```

Open [http://localhost:3000](http://localhost:3000).

## Development Setup

### Backend

```bash
cd apps/backend
pip install uv
uv pip install -e .
python -m playwright install chromium
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd apps/frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The frontend proxies `/api/*` to the backend.

## Architecture

```
apps/
  backend/           FastAPI + SQLModel (SQLite) + LiteLLM
    app/
      services/
        parser.py        MarkItDown → LLM → ResumeData
        generator.py     Full pipeline orchestrator
        ats_scorer.py    6-factor ATS scoring engine
        improver.py      JD keyword extraction + diff tailoring
        pdf.py           Playwright PDF renderer
      routers/
        generate.py      /generate/preview + /generate/confirm
        score.py         /score/{resume_id}
        resumes.py       CRUD + /pdf
        jobs.py          JD upload + keyword extraction
        config.py        LLM provider configuration

  frontend/          Next.js 15 + TypeScript + Tailwind CSS 4
    app/
      (default)/
        page.tsx         Hero landing page
        generate/        3-step wizard
        dashboard/       Resume library with ATS score badges
        builder/[id]/    Resume editor + live ATS panel
        settings/        LLM API key configuration
      print/resumes/     Print route for PDF export
    components/
      ats/               ScoreRing, ScoreFactors, KeywordChips, ATSScorePanel
      generate/          GenerateWizard, StepUpload, StepJD, StepReview
      builder/           ResumeBuilder with ATS sidebar
      resume/            ResumeRenderer (ATS-safe template)
```

## ATS Score Factors

| Factor | Weight | What it checks |
|--------|--------|----------------|
| Contact Information | 10 pts | email, phone, location, LinkedIn |
| Required Sections | 20 pts | summary, experience, education, skills |
| Keyword Match | 35 pts | % of JD keywords found word-by-word |
| Formatting | 15 pts | consistent dates, name present, bullet length |
| Action Verbs | 10 pts | % of bullets starting with strong verbs |
| Quantified Achievements | 10 pts | % of bullets with numbers/metrics |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LLM_PROVIDER` | `openai` | AI provider |
| `LLM_MODEL` | `gpt-4o-mini` | Model name |
| `LLM_API_KEY` | — | Provider API key |
| `LLM_API_BASE` | — | Custom API base (for Ollama) |
| `FRONTEND_BASE_URL` | `http://localhost:3000` | For PDF rendering |
| `BACKEND_ORIGIN` | `http://127.0.0.1:8000` | Backend URL (Next.js side) |
