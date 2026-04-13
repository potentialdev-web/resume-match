"""FastAPI application entry point."""

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db
from app.routers import config, generate, health, jobs, resumes, score

logging.basicConfig(
    level=getattr(logging, settings.log_level),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

app = FastAPI(
    title="Resume Generator API",
    description="AI-powered resume tailoring with ATS scoring",
    version="1.0.0",
    docs_url="/docs",
    openapi_url="/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.effective_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

API_PREFIX = "/api/v1"

app.include_router(health.router, prefix=API_PREFIX)
app.include_router(resumes.router, prefix=API_PREFIX)
app.include_router(jobs.router, prefix=API_PREFIX)
app.include_router(generate.router, prefix=API_PREFIX)
app.include_router(score.router, prefix=API_PREFIX)
app.include_router(config.router, prefix=API_PREFIX)


@app.on_event("startup")
def on_startup() -> None:
    init_db()
    logging.info("Database initialized")


@app.get("/")
def root() -> dict:
    return {
        "name": "Resume Generator API",
        "version": "1.0.0",
        "docs": "/docs",
    }
