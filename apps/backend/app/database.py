"""SQLModel database setup with SQLite."""

import json
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from sqlmodel import Field, Session, SQLModel, create_engine, select

from app.config import settings


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _new_id() -> str:
    return str(uuid.uuid4())


class Resume(SQLModel, table=True):
    id: str = Field(default_factory=_new_id, primary_key=True)
    filename: str = ""
    content: str = "{}"  # JSON string of ResumeData
    is_master: bool = False
    parent_id: Optional[str] = Field(default=None, foreign_key="resume.id")
    processing_status: str = "pending"  # pending | processing | completed | failed
    ats_score: Optional[str] = None  # JSON string of ATSScore (cached)
    created_at: datetime = Field(default_factory=_now)
    updated_at: datetime = Field(default_factory=_now)


class Job(SQLModel, table=True):
    id: str = Field(default_factory=_new_id, primary_key=True)
    content: str = ""  # Raw JD text
    keywords: Optional[str] = None  # JSON string of extracted keywords
    created_at: datetime = Field(default_factory=_now)


class Generation(SQLModel, table=True):
    id: str = Field(default_factory=_new_id, primary_key=True)
    resume_id: str = Field(foreign_key="resume.id")
    job_id: str = Field(foreign_key="job.id")
    tailored_resume_id: Optional[str] = Field(default=None, foreign_key="resume.id")
    ats_score: Optional[str] = None  # JSON of ATSScore
    diffs: Optional[str] = None  # JSON of diff list
    status: str = "pending"  # pending | completed | failed
    created_at: datetime = Field(default_factory=_now)


# ---------------------------------------------------------------------------
# Engine + lifecycle
# ---------------------------------------------------------------------------

_engine = None


def get_engine():
    global _engine
    if _engine is None:
        settings.data_dir.mkdir(parents=True, exist_ok=True)
        db_url = f"sqlite:///{settings.db_path}"
        _engine = create_engine(db_url, echo=False)
    return _engine


def init_db() -> None:
    SQLModel.metadata.create_all(get_engine())


def get_session():
    with Session(get_engine()) as session:
        yield session


# ---------------------------------------------------------------------------
# Resume helpers
# ---------------------------------------------------------------------------

def get_resume(session: Session, resume_id: str) -> Optional[Resume]:
    return session.get(Resume, resume_id)


def list_resumes(session: Session) -> list[Resume]:
    return list(session.exec(select(Resume).order_by(Resume.created_at.desc())).all())


def get_master_resume(session: Session) -> Optional[Resume]:
    statement = select(Resume).where(Resume.is_master == True)
    return session.exec(statement).first()


def create_resume(session: Session, **kwargs: Any) -> Resume:
    resume = Resume(**kwargs)
    session.add(resume)
    session.commit()
    session.refresh(resume)
    return resume


def update_resume(session: Session, resume: Resume, **kwargs: Any) -> Resume:
    for key, value in kwargs.items():
        setattr(resume, key, value)
    resume.updated_at = _now()
    session.add(resume)
    session.commit()
    session.refresh(resume)
    return resume


def delete_resume(session: Session, resume: Resume) -> None:
    session.delete(resume)
    session.commit()


# ---------------------------------------------------------------------------
# Job helpers
# ---------------------------------------------------------------------------

def get_job(session: Session, job_id: str) -> Optional[Job]:
    return session.get(Job, job_id)


def create_job(session: Session, content: str) -> Job:
    job = Job(content=content)
    session.add(job)
    session.commit()
    session.refresh(job)
    return job


def update_job_keywords(session: Session, job: Job, keywords: dict[str, Any]) -> Job:
    job.keywords = json.dumps(keywords)
    session.add(job)
    session.commit()
    session.refresh(job)
    return job


# ---------------------------------------------------------------------------
# Generation helpers
# ---------------------------------------------------------------------------

def get_generation_by_tailored_resume(session: Session, tailored_resume_id: str) -> Optional[Generation]:
    """Look up the generation record that produced a given tailored resume."""
    statement = select(Generation).where(Generation.tailored_resume_id == tailored_resume_id)
    return session.exec(statement).first()


def create_generation(session: Session, **kwargs: Any) -> Generation:
    gen = Generation(**kwargs)
    session.add(gen)
    session.commit()
    session.refresh(gen)
    return gen


def update_generation(session: Session, gen: Generation, **kwargs: Any) -> Generation:
    for key, value in kwargs.items():
        setattr(gen, key, value)
    session.add(gen)
    session.commit()
    session.refresh(gen)
    return gen
