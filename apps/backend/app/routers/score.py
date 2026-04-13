"""ATS score routes."""

import json
import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.database import get_job, get_resume, get_session, update_resume
from app.schemas.models import ATSScore, ResumeData
from app.services.ats_scorer import calculate_ats_score
from app.services.improver import run_ats_boost_pass, run_quantification_pass
from app.services.normalizer import normalize_resume_dates

router = APIRouter(prefix="/score", tags=["score"])
logger = logging.getLogger(__name__)


@router.get("/{resume_id}")
async def get_ats_score(
    resume_id: str,
    job_id: str | None = None,
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    """Calculate (or return cached) ATS score for a resume.

    Pass job_id to include keyword matching against a specific JD.
    """
    resume = get_resume(session, resume_id)
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")

    parsed: dict[str, Any] = {}
    if resume.content:
        try:
            parsed = json.loads(resume.content)
        except json.JSONDecodeError:
            raise HTTPException(status_code=500, detail="Invalid resume data")

    job_keywords: dict[str, Any] = {}
    if job_id:
        job = get_job(session, job_id)
        if job and job.keywords:
            try:
                job_keywords = json.loads(job.keywords)
            except json.JSONDecodeError:
                pass

    ats_score = calculate_ats_score(parsed, job_keywords)

    # Cache score on the resume record
    try:
        update_resume(session, resume, ats_score=json.dumps(ats_score.model_dump()))
    except Exception:
        pass

    return {
        "resume_id": resume_id,
        "job_id": job_id,
        "ats_score": ats_score.model_dump(),
    }


@router.post("/calculate")
async def calculate_score_from_data(
    body: dict[str, Any],
) -> dict[str, Any]:
    """Calculate ATS score from raw resume data (no DB storage)."""
    resume_data = body.get("resume")
    job_keywords = body.get("job_keywords", {})

    if not resume_data:
        raise HTTPException(status_code=400, detail="resume field is required")

    ats_score = calculate_ats_score(resume_data, job_keywords)
    return {"ats_score": ats_score.model_dump()}


@router.post("/optimize")
async def optimize_resume(
    body: dict[str, Any],
) -> dict[str, Any]:
    """Run AI boost pass + date normalization on an in-editor resume.

    Accepts the current resume state + optional job keywords.
    Returns the optimized resume dict and updated ATS score.
    Does NOT persist to the database.
    """
    resume_data = body.get("resume")
    job_keywords: dict[str, Any] = body.get("job_keywords") or {}

    if not resume_data:
        raise HTTPException(status_code=400, detail="resume field is required")

    # Step 1: Normalize date formats (fast, no LLM)
    normalized = normalize_resume_dates(resume_data)

    # Step 2: Score after normalization to get missing keywords
    pre_score = calculate_ats_score(normalized, job_keywords)

    # Step 3a: Boost pass — fix action verbs + inject missing keywords
    try:
        boosted = await run_ats_boost_pass(
            resume=normalized,
            missing_keywords=pre_score.missing_keywords,
            current_score=pre_score.overall,
        )
    except Exception as e:
        logger.warning("Optimize boost pass failed: %s", e)
        boosted = normalized

    # Step 3b: Dedicated quantification pass — batched, covers all bullets
    try:
        boosted = await run_quantification_pass(resume=boosted)
    except Exception as e:
        logger.warning("Quantification pass failed: %s", e)

    # Step 4: Validate against schema
    try:
        validated = ResumeData.model_validate(boosted)
        boosted = validated.model_dump()
    except Exception as e:
        logger.warning("Schema validation after optimize failed: %s", e)
        boosted = normalized

    # Step 5: Final score
    final_score = calculate_ats_score(boosted, job_keywords)
    logger.info(
        "Optimize: %.1f → %.1f after date norm + boost + quantification",
        pre_score.overall, final_score.overall,
    )

    return {
        "resume": boosted,
        "ats_score": final_score.model_dump(),
        "previous_score": pre_score.overall,
    }
