"""Resume CRUD and upload routes."""

import json
import logging
import uuid
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response
from sqlmodel import Session

from app.config import settings
from app.database import (
    create_resume,
    delete_resume,
    get_generation_by_tailored_resume,
    get_job,
    get_master_resume,
    get_resume,
    get_session,
    list_family_members,
    list_resumes,
    update_resume,
)
from app.schemas.models import ATSScore, ResumeData, ResumeListItem
from app.services.job_label import safe_filename_stem
from app.services.parser import parse_document, parse_resume_to_json
from app.services.pdf import render_resume_pdf

router = APIRouter(prefix="/resumes", tags=["resumes"])
logger = logging.getLogger(__name__)

_ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
}


@router.post("/upload")
async def upload_resume(
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    """Upload and parse a base resume (PDF/DOCX/TXT)."""
    if file.content_type not in _ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {file.content_type}")

    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 10MB)")

    request_id = str(uuid.uuid4())

    # Determine if this should become the master resume
    existing_master = get_master_resume(session)
    is_master = existing_master is None

    # Create DB record in pending state
    resume = create_resume(
        session,
        filename=file.filename or "resume",
        content="{}",
        is_master=is_master,
        processing_status="processing",
    )

    # Parse document
    try:
        markdown = await parse_document(content, file.filename or "resume.pdf")
        parsed = await parse_resume_to_json(markdown)
        update_resume(
            session,
            resume,
            content=json.dumps(parsed),
            processing_status="completed",
        )
    except Exception as e:
        logger.exception("Resume parsing failed: %s", e)
        update_resume(session, resume, processing_status="failed")
        raise HTTPException(status_code=500, detail=f"Resume parsing failed: {e}") from e

    return {
        "request_id": request_id,
        "resume_id": resume.id,
        "processing_status": "completed",
        "is_master": resume.is_master,
        "filename": resume.filename,
        "parsed_data": parsed,
    }


@router.get("/list")
def list_all_resumes(session: Session = Depends(get_session)) -> dict[str, Any]:
    """List all resumes."""
    resumes = list_resumes(session)
    items: list[ResumeListItem] = []
    for r in resumes:
        ats: ATSScore | None = None
        if r.ats_score:
            try:
                ats = ATSScore.model_validate(json.loads(r.ats_score))
            except Exception:
                pass
        items.append(ResumeListItem(
            id=r.id,
            filename=r.filename,
            is_master=r.is_master,
            parent_id=r.parent_id,
            processing_status=r.processing_status,
            ats_score=ats,
            created_at=r.created_at.isoformat(),
            updated_at=r.updated_at.isoformat(),
        ))
    return {"data": [i.model_dump() for i in items]}


@router.get("/{resume_id}")
def get_resume_by_id(
    resume_id: str,
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    """Fetch a single resume by ID."""
    resume = get_resume(session, resume_id)
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")

    parsed: dict[str, Any] = {}
    if resume.content:
        try:
            parsed = json.loads(resume.content)
        except json.JSONDecodeError:
            pass

    ats: ATSScore | None = None
    if resume.ats_score:
        try:
            ats = ATSScore.model_validate(json.loads(resume.ats_score))
        except Exception:
            pass

    # Look up the generation record to find associated job keywords
    job_id: str | None = None
    job_keywords: dict[str, Any] = {}
    generation = get_generation_by_tailored_resume(session, resume_id)
    if generation:
        job_id = generation.job_id
        job = get_job(session, generation.job_id)
        if job and job.keywords:
            try:
                job_keywords = json.loads(job.keywords)
            except json.JSONDecodeError:
                pass

    family_members = list_family_members(session, resume_id)
    base_id = family_members[0].id if family_members else resume.id
    family_payload: list[dict[str, Any]] = []
    for m in family_members:
        ats_m: ATSScore | None = None
        if m.ats_score:
            try:
                ats_m = ATSScore.model_validate(json.loads(m.ats_score))
            except Exception:
                pass
        family_payload.append(
            {
                "id": m.id,
                "filename": m.filename,
                "is_base": m.id == base_id,
                "ats_overall": round(ats_m.overall) if ats_m else None,
            }
        )

    return {
        "id": resume.id,
        "filename": resume.filename,
        "is_master": resume.is_master,
        "parent_id": resume.parent_id,
        "processing_status": resume.processing_status,
        "parsed_data": parsed,
        "ats_score": ats.model_dump() if ats else None,
        "job_id": job_id,
        "job_keywords": job_keywords,
        "base_id": base_id,
        "family": family_payload,
        "created_at": resume.created_at.isoformat(),
        "updated_at": resume.updated_at.isoformat(),
    }


@router.patch("/{resume_id}/label")
def update_resume_label(
    resume_id: str,
    body: dict[str, Any],
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    """Update dashboard/builder display name (stored as filename stem + .json)."""
    resume = get_resume(session, resume_id)
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")
    label = str(body.get("label", "")).strip()
    if not label:
        raise HTTPException(status_code=400, detail="label is required")
    stem = safe_filename_stem(label)
    new_fn = f"{stem}.json"
    update_resume(session, resume, filename=new_fn)
    return {"success": True, "filename": new_fn}


@router.patch("/{resume_id}")
def update_resume_data(
    resume_id: str,
    body: dict[str, Any],
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    """Save edited resume data."""
    resume = get_resume(session, resume_id)
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")

    # Validate with schema
    try:
        validated = ResumeData.model_validate(body)
        content = json.dumps(validated.model_dump())
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Invalid resume data: {e}") from e

    update_resume(session, resume, content=content)
    return {"success": True, "resume_id": resume_id}


@router.delete("/{resume_id}")
def delete_resume_by_id(
    resume_id: str,
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    """Delete a resume."""
    resume = get_resume(session, resume_id)
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")
    delete_resume(session, resume)
    return {"success": True}


@router.get("/{resume_id}/pdf")
async def download_resume_pdf(
    resume_id: str,
    template: str = "modern",
    page_size: str = "A4",
    session: Session = Depends(get_session),
) -> Response:
    """Export resume to PDF via Playwright."""
    resume = get_resume(session, resume_id)
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")

    url = f"{settings.frontend_base_url}/print/resumes/{resume_id}?template={template}"
    try:
        pdf_bytes = await render_resume_pdf(url=url, page_size=page_size)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {e}") from e

    filename = f"resume_{resume_id[:8]}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
