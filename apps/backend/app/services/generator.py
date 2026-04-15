"""Main resume generation pipeline.

Orchestrates:
  1. Keyword extraction from JD
  2. Diff-based tailoring (LLM)
  3. Keyword injection refinement
  4. ATS scoring
"""

import copy
import json
import logging
import re
from typing import Any

from app.schemas import ResumeData
from app.schemas.models import ATSScore
from app.services.ats_scorer import calculate_ats_score
from app.services.improver import (
    apply_diffs,
    extract_job_keywords,
    generate_resume_diffs,
    run_ats_boost_pass,
    run_quantification_pass,
    _preserve_personal_info,
)
from app.services.job_label import display_label_from_jd

logger = logging.getLogger(__name__)

_AI_PHRASE_BLACKLIST = [
    "dynamic", "results-driven", "proven track record", "leverage",
    "synergy", "passionate", "motivated", "team player", "fast-paced",
    "detail-oriented", "go-getter", "thought leader", "game-changer",
    "innovative", "strategic thinker", "exceptional", "excellent communication",
]

_AI_PHRASE_REPLACEMENTS = {
    "leverage": "use",
    "utilize": "use",
    "synergy": "collaboration",
    "passionate about": "focused on",
    "dynamic": "",
    "results-driven": "",
    "proven track record": "",
}


def _remove_ai_phrases(text: str) -> str:
    """Remove common AI-generated buzzwords from text."""
    result = text
    for phrase, replacement in _AI_PHRASE_REPLACEMENTS.items():
        result = re.sub(
            rf"\b{re.escape(phrase)}\b",
            replacement,
            result,
            flags=re.IGNORECASE,
        )
    result = re.sub(r"\s{2,}", " ", result).strip()
    return result


def _clean_resume_phrases(resume: dict[str, Any]) -> dict[str, Any]:
    """Remove AI buzzwords from all text fields recursively."""
    result = copy.deepcopy(resume)

    summary = result.get("summary", "")
    if summary:
        result["summary"] = _remove_ai_phrases(summary)

    for exp in result.get("workExperience", []):
        desc = exp.get("description", [])
        exp["description"] = [_remove_ai_phrases(b) for b in desc]

    for proj in result.get("personalProjects", []):
        desc = proj.get("description", [])
        proj["description"] = [_remove_ai_phrases(b) for b in desc]

    return result


async def generate_tailored_resume(
    base_resume: dict[str, Any],
    job_description: str,
    prompt_id: str = "keywords",
    output_language: str = "English",
) -> dict[str, Any]:
    """Generate a tailored resume from base + job description using diff-based editing.

    Args:
        base_resume: Parsed ResumeData dict
        job_description: Raw JD text
        prompt_id: Tailoring strategy ("nudge", "keywords", "full")
        output_language: Language for generated content

    Returns:
        Tuple of (tailored_resume_dict, job_keywords_dict, diffs_list)
    """
    # Step 1: Extract JD keywords
    job_keywords = await extract_job_keywords(job_description)
    logger.info("Extracted %d keyword categories", len(job_keywords))

    # Step 2: Generate targeted diffs
    try:
        diff_result = await generate_resume_diffs(
            original_resume=base_resume,
            job_description=job_description,
            job_keywords=job_keywords,
            prompt_id=prompt_id,
            output_language=output_language,
        )
        changes = diff_result.get("changes", [])
    except Exception as e:
        logger.warning("Diff generation failed: %s — using base resume", e)
        changes = []

    # Step 3: Apply diffs
    tailored = apply_diffs(base_resume, changes)

    # Step 4: Restore personal info (safety)
    tailored = _preserve_personal_info(tailored, base_resume)

    # Step 5: Clean AI buzzwords
    tailored = _clean_resume_phrases(tailored)

    # Step 6: Validate against schema
    try:
        validated = ResumeData.model_validate(tailored)
        tailored = validated.model_dump()
    except Exception as e:
        logger.warning("Schema validation after tailoring failed: %s — using base", e)
        tailored = copy.deepcopy(base_resume)

    return tailored, job_keywords, changes


_ATS_BOOST_TARGET = 90.0   # run boost pass if score is below this
_ATS_BOOST_MAX_ITERS = 2   # max boost iterations to avoid runaway LLM calls


async def run_generation_pipeline(
    base_resume: dict[str, Any],
    job_description: str,
    prompt_id: str = "keywords",
    output_language: str = "English",
) -> dict[str, Any]:
    """Full pipeline: tailor → ATS boost (iterative) → score.

    Returns:
        {
            "tailored_resume": ...,
            "job_keywords": ...,
            "diffs": [...],
            "ats_score": ATSScore,
            "base_ats_score": ATSScore,
        }
    """
    # Score base resume first (for comparison)
    base_ats = calculate_ats_score(base_resume)

    # Run initial tailoring
    tailored, job_keywords, diffs = await generate_tailored_resume(
        base_resume=base_resume,
        job_description=job_description,
        prompt_id=prompt_id,
        output_language=output_language,
    )

    # Score after initial tailoring
    tailored_ats = calculate_ats_score(tailored, job_keywords)
    logger.info("Initial ATS score: %.1f", tailored_ats.overall)

    # ATS boost: pass 1 — action verbs + keyword injection (fast)
    if tailored_ats.overall < _ATS_BOOST_TARGET:
        logger.info("ATS boost pass 1 — score=%.1f", tailored_ats.overall)
        boosted = await run_ats_boost_pass(
            resume=tailored,
            missing_keywords=tailored_ats.missing_keywords,
            current_score=tailored_ats.overall,
        )
        try:
            from app.schemas import ResumeData
            validated = ResumeData.model_validate(boosted)
            boosted = validated.model_dump()
            boosted_ats = calculate_ats_score(boosted, job_keywords)
            if boosted_ats.overall >= tailored_ats.overall:
                tailored, tailored_ats = boosted, boosted_ats
                logger.info("After boost pass 1: score=%.1f", tailored_ats.overall)
        except Exception as e:
            logger.warning("Boost pass 1 failed validation: %s", e)

    # ATS boost: pass 2 — dedicated quantification (batched, comprehensive)
    logger.info("Quantification pass — score=%.1f", tailored_ats.overall)
    quantified = await run_quantification_pass(resume=tailored)
    try:
        from app.schemas import ResumeData
        validated = ResumeData.model_validate(quantified)
        quantified = validated.model_dump()
        quant_ats = calculate_ats_score(quantified, job_keywords)
        if quant_ats.overall >= tailored_ats.overall:
            tailored, tailored_ats = quantified, quant_ats
            logger.info("After quantification pass: score=%.1f", tailored_ats.overall)
    except Exception as e:
        logger.warning("Quantification pass failed validation: %s", e)

    return {
        "tailored_resume": tailored,
        "job_keywords": job_keywords,
        "diffs": diffs,
        "ats_score": tailored_ats,
        "base_ats_score": base_ats,
        "job_label": display_label_from_jd(job_description),
    }
