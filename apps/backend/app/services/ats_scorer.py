"""ATS (Applicant Tracking System) score calculation service.

Scores resumes on 6 factors with a total of 100 points:
  - Contact completeness  10 pts
  - Required sections     20 pts
  - Keyword match         35 pts
  - Formatting            15 pts
  - Action verbs          10 pts
  - Quantification        10 pts
"""

import re
from typing import Any

from app.schemas.models import ATSScore, ATSScoreFactor, ats_grade

# ---------------------------------------------------------------------------
# Action verb lists for bullet scoring
# ---------------------------------------------------------------------------

_ACTION_VERBS = frozenset({
    "accelerated", "achieved", "acquired", "adapted", "administered", "advanced",
    "analyzed", "architected", "automated", "built", "championed", "collaborated",
    "coordinated", "created", "cut", "decreased", "defined", "delivered",
    "deployed", "designed", "developed", "diagnosed", "directed", "drove",
    "eliminated", "enabled", "engineered", "enhanced", "established", "evaluated",
    "executed", "expanded", "facilitated", "generated", "grew", "guided",
    "identified", "implemented", "improved", "increased", "initiated", "integrated",
    "introduced", "launched", "led", "maintained", "managed", "mentored", "migrated",
    "modernized", "monitored", "optimized", "orchestrated", "owned", "partnered",
    "performed", "pioneered", "planned", "produced", "programmed", "published",
    "rebuilt", "redesigned", "reduced", "refactored", "released", "researched",
    "resolved", "restructured", "scaled", "secured", "shaped", "shipped",
    "simplified", "spearheaded", "streamlined", "supported", "transformed",
    "unified", "upgraded", "utilized", "validated",
})

# Numbers/metrics pattern (~ prefix for AI-generated estimates is also accepted)
_METRIC_RE = re.compile(r"~?\d+\s*(?:%|x|X|\+|k\b|K\b|M\b|B\b|\$|ms\b|s\b)")
_NUMBER_RE = re.compile(r"~?\b\d[\d,]*(?:\.\d+)?\b")

# Date format patterns for consistency check
_DATE_RE = re.compile(
    r"(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?"
    r"|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)"
    r"\.?\s+\d{4}|Present|Current",
    re.IGNORECASE,
)


def _extract_all_text(resume: dict[str, Any]) -> str:
    """Extract all text content from resume dict."""
    parts: list[str] = []

    def _recurse(obj: Any) -> None:
        if isinstance(obj, str):
            parts.append(obj)
        elif isinstance(obj, list):
            for item in obj:
                _recurse(item)
        elif isinstance(obj, dict):
            for v in obj.values():
                _recurse(v)

    _recurse(resume)
    return " ".join(parts).lower()


def _keyword_in_text(keyword: str, text: str) -> bool:
    escaped = re.escape(keyword.lower())
    return bool(re.search(rf"\b{escaped}\b", text))


def _get_all_bullets(resume: dict[str, Any]) -> list[str]:
    """Return all experience and project bullet strings."""
    bullets: list[str] = []
    for exp in resume.get("workExperience", []):
        bullets.extend(exp.get("description", []))
    for proj in resume.get("personalProjects", []):
        bullets.extend(proj.get("description", []))
    summary = resume.get("summary", "")
    if summary:
        bullets.append(summary)
    return bullets


# ---------------------------------------------------------------------------
# Factor scoring functions
# ---------------------------------------------------------------------------

def _score_contact(resume: dict[str, Any]) -> ATSScoreFactor:
    """Score contact information completeness (10 pts)."""
    info = resume.get("personalInfo", {})
    fields = {
        "email": info.get("email", ""),
        "phone": info.get("phone", ""),
        "location": info.get("location", ""),
        "linkedin": info.get("linkedin", ""),
    }
    filled = sum(1 for v in fields.values() if v and str(v).strip())
    earned = (filled / len(fields)) * 10
    missing = [k for k, v in fields.items() if not v or not str(v).strip()]

    tip = None
    if missing:
        tip = f"Add missing contact fields: {', '.join(missing)}"

    return ATSScoreFactor(
        name="Contact Information",
        score=round((earned / 10) * 100),
        max_score=10,
        earned=round(earned, 1),
        description=f"{filled}/{len(fields)} contact fields present",
        tip=tip,
    )


def _score_sections(resume: dict[str, Any]) -> ATSScoreFactor:
    """Score required sections presence (20 pts)."""
    checks = {
        "summary": bool(resume.get("summary", "").strip()),
        "work experience": bool(resume.get("workExperience")),
        "education": bool(resume.get("education")),
        "skills": bool(resume.get("additional", {}).get("technicalSkills")),
    }
    filled = sum(1 for v in checks.values() if v)
    earned = (filled / len(checks)) * 20
    missing = [k for k, v in checks.items() if not v]

    tip = None
    if missing:
        tip = f"Add missing sections: {', '.join(missing)}"

    return ATSScoreFactor(
        name="Required Sections",
        score=round((earned / 20) * 100),
        max_score=20,
        earned=round(earned, 1),
        description=f"{filled}/{len(checks)} required sections present",
        tip=tip,
    )


def _score_keywords(
    resume: dict[str, Any],
    job_keywords: dict[str, Any],
) -> tuple[ATSScoreFactor, list[str], list[str]]:
    """Score keyword match (35 pts)."""
    all_keywords: list[str] = []
    for key in ("required_skills", "preferred_skills", "keywords"):
        kws = job_keywords.get(key, [])
        if isinstance(kws, list):
            all_keywords.extend(str(k) for k in kws if k)

    all_keywords = list(dict.fromkeys(k.strip() for k in all_keywords if k.strip()))

    if not all_keywords:
        return ATSScoreFactor(
            name="Keyword Match",
            score=0,
            max_score=35,
            earned=0,
            description="No JD keywords available to match",
            tip="Upload a job description to enable keyword matching",
        ), [], []

    resume_text = _extract_all_text(resume)
    matched = [kw for kw in all_keywords if _keyword_in_text(kw, resume_text)]
    missing = [kw for kw in all_keywords if kw not in matched]
    pct = len(matched) / len(all_keywords)
    earned = pct * 35

    tip = None
    if missing[:5]:
        tip = f"Add these missing keywords: {', '.join(missing[:5])}"

    return ATSScoreFactor(
        name="Keyword Match",
        score=round(pct * 100),
        max_score=35,
        earned=round(earned, 1),
        description=f"{len(matched)}/{len(all_keywords)} JD keywords found in resume",
        tip=tip,
    ), matched, missing


def _score_formatting(resume: dict[str, Any]) -> ATSScoreFactor:
    """Score ATS-safe formatting (15 pts)."""
    score = 15.0
    issues: list[str] = []

    # Check date consistency
    date_matches = 0
    experience = resume.get("workExperience", [])
    for exp in experience:
        years = exp.get("years", "")
        if years and _DATE_RE.search(years):
            date_matches += 1

    if experience and date_matches < len(experience) * 0.5:
        score -= 5
        issues.append("Inconsistent date formats")

    # Check name is present
    info = resume.get("personalInfo", {})
    if not info.get("name", "").strip():
        score -= 5
        issues.append("Missing candidate name")

    # Check for very long bullets (hard for ATS to parse)
    bullets = _get_all_bullets(resume)
    long_bullets = [b for b in bullets if len(b) > 250]
    if len(long_bullets) > 3:
        score -= 3
        issues.append("Several bullets exceed 250 characters")

    # Check skills aren't empty
    skills = resume.get("additional", {}).get("technicalSkills", [])
    if not skills:
        score -= 2
        issues.append("No skills listed")

    score = max(0, score)
    tip = None
    if issues:
        tip = "Fix: " + "; ".join(issues)

    return ATSScoreFactor(
        name="Formatting",
        score=round((score / 15) * 100),
        max_score=15,
        earned=round(score, 1),
        description="ATS-safe formatting check" if not issues else f"{len(issues)} issue(s) found",
        tip=tip,
    )


def _score_action_verbs(resume: dict[str, Any]) -> ATSScoreFactor:
    """Score action verb usage in bullets (10 pts)."""
    bullets = _get_all_bullets(resume)

    if not bullets:
        return ATSScoreFactor(
            name="Action Verbs",
            score=0,
            max_score=10,
            earned=0,
            description="No bullet points found",
            tip="Add experience or project bullet points starting with action verbs",
        )

    strong_bullets = 0
    for bullet in bullets:
        first_word = bullet.strip().split()[0].lower().rstrip(".,;:") if bullet.strip() else ""
        if first_word in _ACTION_VERBS:
            strong_bullets += 1

    pct = strong_bullets / len(bullets)
    earned = pct * 10

    tip = None
    if pct < 0.7:
        tip = "Start more bullet points with strong action verbs (e.g., Built, Led, Improved)"

    return ATSScoreFactor(
        name="Action Verbs",
        score=round(pct * 100),
        max_score=10,
        earned=round(earned, 1),
        description=f"{strong_bullets}/{len(bullets)} bullets start with action verbs",
        tip=tip,
    )


def _score_quantification(resume: dict[str, Any]) -> ATSScoreFactor:
    """Score quantified achievements (10 pts)."""
    bullets = []
    for exp in resume.get("workExperience", []):
        bullets.extend(exp.get("description", []))
    for proj in resume.get("personalProjects", []):
        bullets.extend(proj.get("description", []))

    if not bullets:
        return ATSScoreFactor(
            name="Quantified Achievements",
            score=0,
            max_score=10,
            earned=0,
            description="No experience bullets found",
            tip="Add measurable achievements with numbers (e.g., 'Reduced load time by 40%')",
        )

    quantified = sum(
        1 for b in bullets
        if _METRIC_RE.search(b) or _NUMBER_RE.search(b)
    )
    pct = quantified / len(bullets)
    earned = pct * 10

    tip = None
    if pct < 0.3:
        tip = "Add measurable results to more bullets (e.g., '40% faster', '$2M revenue', '10K users')"

    return ATSScoreFactor(
        name="Quantified Achievements",
        score=round(pct * 100),
        max_score=10,
        earned=round(earned, 1),
        description=f"{quantified}/{len(bullets)} bullets contain measurable results",
        tip=tip,
    )


# ---------------------------------------------------------------------------
# Main scoring function
# ---------------------------------------------------------------------------

def calculate_ats_score(
    resume: dict[str, Any],
    job_keywords: dict[str, Any] | None = None,
) -> ATSScore:
    """Calculate a full ATS score for a resume.

    Args:
        resume: ResumeData dict
        job_keywords: Extracted keywords dict from extract_job_keywords()

    Returns:
        ATSScore with factor breakdown and keyword lists
    """
    if job_keywords is None:
        job_keywords = {}

    contact_factor = _score_contact(resume)
    sections_factor = _score_sections(resume)
    keyword_factor, matched_kws, missing_kws = _score_keywords(resume, job_keywords)
    formatting_factor = _score_formatting(resume)
    verbs_factor = _score_action_verbs(resume)
    quant_factor = _score_quantification(resume)

    factors = [
        contact_factor,
        sections_factor,
        keyword_factor,
        formatting_factor,
        verbs_factor,
        quant_factor,
    ]

    total_earned = sum(f.earned for f in factors)
    total_max = sum(f.max_score for f in factors)
    overall = round((total_earned / total_max) * 100, 1) if total_max > 0 else 0

    all_keywords = list(dict.fromkeys(matched_kws + missing_kws))
    kw_pct = round(len(matched_kws) / len(all_keywords) * 100, 1) if all_keywords else 0

    return ATSScore(
        overall=overall,
        grade=ats_grade(overall),
        factors=factors,
        matched_keywords=matched_kws,
        missing_keywords=missing_kws,
        total_keywords=len(all_keywords),
        keyword_match_pct=kw_pct,
    )
