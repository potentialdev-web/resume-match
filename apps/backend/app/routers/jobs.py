"""Job description upload and retrieval routes."""

import json
import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session

from app.database import create_job, get_job, get_session, update_job_keywords
from app.services.improver import extract_job_keywords

router = APIRouter(prefix="/jobs", tags=["jobs"])
logger = logging.getLogger(__name__)


class JobUploadRequest(BaseModel):
    content: str  # Raw job description text


@router.post("/upload")
async def upload_job(
    body: JobUploadRequest,
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    """Store a job description and extract keywords."""
    if not body.content or not body.content.strip():
        raise HTTPException(status_code=400, detail="Job description cannot be empty")

    job = create_job(session, content=body.content)

    # Extract keywords asynchronously
    try:
        keywords = await extract_job_keywords(body.content)
        update_job_keywords(session, job, keywords)
    except Exception as e:
        logger.warning("Keyword extraction failed for job %s: %s", job.id, e)
        keywords = {}

    return {
        "job_id": job.id,
        "keywords": keywords,
        "created_at": job.created_at.isoformat(),
    }


@router.get("/{job_id}")
def get_job_by_id(
    job_id: str,
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    """Fetch a job description by ID."""
    job = get_job(session, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    keywords: dict[str, Any] = {}
    if job.keywords:
        try:
            keywords = json.loads(job.keywords)
        except json.JSONDecodeError:
            pass

    return {
        "job_id": job.id,
        "content": job.content,
        "keywords": keywords,
        "created_at": job.created_at.isoformat(),
    }
