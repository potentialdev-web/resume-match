"""Resume generation routes — preview, confirm, and one-shot generate."""

import json
import logging
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.database import (
    create_generation,
    create_resume,
    get_job,
    get_resume,
    get_session,
    update_generation,
    update_resume,
)
from app.schemas.models import (
    ATSScore,
    GenerateConfirmResponse,
    GeneratePreviewResponse,
    GenerateRequest,
    ResumeData,
)
from app.services.generator import run_generation_pipeline

router = APIRouter(prefix="/generate", tags=["generate"])
logger = logging.getLogger(__name__)

# In-memory preview cache {generation_id: preview_data}
_preview_cache: dict[str, dict[str, Any]] = {}


@router.post("/preview", response_model=GeneratePreviewResponse)
async def generate_preview(
    body: GenerateRequest,
    session: Session = Depends(get_session),
) -> GeneratePreviewResponse:
    """Generate a tailored resume preview without persisting.

    Returns diffs + ATS score for user review before confirming.
    """
    resume = get_resume(session, body.resume_id)
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")

    job = get_job(session, body.job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    base_data: dict[str, Any] = {}
    if resume.content:
        try:
            base_data = json.loads(resume.content)
        except json.JSONDecodeError:
            raise HTTPException(status_code=500, detail="Invalid resume data in database")

    if not base_data:
        raise HTTPException(status_code=400, detail="Resume has no parsed content")

    try:
        result = await run_generation_pipeline(
            base_resume=base_data,
            job_description=job.content,
        )
    except Exception as e:
        logger.exception("Generation pipeline failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Generation failed: {e}") from e

    tailored = result["tailored_resume"]
    ats_score: ATSScore = result["ats_score"]
    base_ats: ATSScore = result["base_ats_score"]
    diffs: list[Any] = result["diffs"]
    job_keywords = result["job_keywords"]

    # Cache for confirm step
    generation_id = str(uuid.uuid4())
    _preview_cache[generation_id] = {
        "resume_id": body.resume_id,
        "job_id": body.job_id,
        "tailored_resume": tailored,
        "ats_score": ats_score.model_dump(),
        "base_ats_score": base_ats.model_dump(),
        "diffs": diffs,
        "job_keywords": job_keywords,
    }

    return GeneratePreviewResponse(
        generation_id=generation_id,
        tailored_resume=ResumeData.model_validate(tailored),
        ats_score=ats_score,
        diffs=diffs,
        base_ats_score=base_ats,
    )


@router.post("/confirm", response_model=GenerateConfirmResponse)
async def confirm_generation(
    body: dict[str, Any],
    session: Session = Depends(get_session),
) -> GenerateConfirmResponse:
    """Confirm and persist a previously previewed generation.

    Accepts either a generation_id (from cache) or a full tailored_resume body.
    """
    generation_id = body.get("generation_id", "")
    cached = _preview_cache.pop(generation_id, None)

    if not cached:
        raise HTTPException(
            status_code=400,
            detail="Preview not found. Generate a preview first or it may have expired.",
        )

    resume_id = cached["resume_id"]
    job_id = cached["job_id"]
    tailored = cached["tailored_resume"]
    ats_score_dict = cached["ats_score"]

    # Allow caller to pass edited resume that overrides the cached one
    if "tailored_resume" in body:
        try:
            validated = ResumeData.model_validate(body["tailored_resume"])
            tailored = validated.model_dump()
        except Exception as e:
            raise HTTPException(status_code=422, detail=f"Invalid resume data: {e}") from e

    # Save tailored resume as child of base
    ats_score = ATSScore.model_validate(ats_score_dict)

    tailored_resume = create_resume(
        session,
        filename=f"tailored_{resume_id[:8]}.json",
        content=json.dumps(tailored),
        is_master=False,
        parent_id=resume_id,
        processing_status="completed",
        ats_score=json.dumps(ats_score_dict),
    )

    # Record generation
    create_generation(
        session,
        resume_id=resume_id,
        job_id=job_id,
        tailored_resume_id=tailored_resume.id,
        ats_score=json.dumps(ats_score_dict),
        diffs=json.dumps(cached.get("diffs", [])),
        status="completed",
    )

    return GenerateConfirmResponse(
        tailored_resume_id=tailored_resume.id,
        tailored_resume=ResumeData.model_validate(tailored),
        ats_score=ats_score,
    )


@router.post("")
async def generate_one_shot(
    body: GenerateRequest,
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    """One-shot generate + persist (no preview step)."""
    resume = get_resume(session, body.resume_id)
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")

    job = get_job(session, body.job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    base_data: dict[str, Any] = {}
    if resume.content:
        try:
            base_data = json.loads(resume.content)
        except json.JSONDecodeError:
            raise HTTPException(status_code=500, detail="Invalid resume data")

    try:
        result = await run_generation_pipeline(
            base_resume=base_data,
            job_description=job.content,
        )
    except Exception as e:
        logger.exception("Generation failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e)) from e

    tailored = result["tailored_resume"]
    ats_score: ATSScore = result["ats_score"]

    tailored_resume = create_resume(
        session,
        filename=f"tailored_{resume.id[:8]}.json",
        content=json.dumps(tailored),
        is_master=False,
        parent_id=resume.id,
        processing_status="completed",
        ats_score=json.dumps(ats_score.model_dump()),
    )

    create_generation(
        session,
        resume_id=resume.id,
        job_id=job.id,
        tailored_resume_id=tailored_resume.id,
        ats_score=json.dumps(ats_score.model_dump()),
        diffs=json.dumps(result.get("diffs", [])),
        status="completed",
    )

    return {
        "tailored_resume_id": tailored_resume.id,
        "tailored_resume": tailored,
        "ats_score": ats_score.model_dump(),
        "base_ats_score": result["base_ats_score"].model_dump(),
    }
