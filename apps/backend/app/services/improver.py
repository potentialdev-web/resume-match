"""Resume improvement service — keyword extraction and diff-based tailoring."""

import copy
import json
import logging
import re
from difflib import SequenceMatcher
from typing import Any

from app.llm import complete_json
from app.prompts import (
    ATS_BOOST_PROMPT,
    QUANTIFY_BULLETS_PROMPT,
    CRITICAL_TRUTHFULNESS_RULES,
    DEFAULT_IMPROVE_PROMPT_ID,
    DIFF_IMPROVE_PROMPT,
    DIFF_STRATEGY_INSTRUCTIONS,
    EXTRACT_KEYWORDS_PROMPT,
    IMPROVE_RESUME_PROMPTS,
    IMPROVE_SCHEMA_EXAMPLE,
)
from app.schemas import ResumeData

logger = logging.getLogger(__name__)

_INJECTION_PATTERNS = [
    r"ignore\s+(all\s+)?previous\s+instructions",
    r"disregard\s+(all\s+)?above",
    r"forget\s+(everything|all)",
    r"new\s+instructions?:",
    r"system\s*:",
    r"<\s*/?\s*system\s*>",
    r"\[\s*INST\s*\]",
]

_PATH_SEGMENT_RE = re.compile(r"([a-zA-Z_]+)(?:\[(\d+)\])?")

_ALLOWED_PATH_PATTERNS = [
    re.compile(r"^summary$"),
    re.compile(r"^workExperience\[\d+\]\.description(\[\d+\])?$"),
    re.compile(r"^personalProjects\[\d+\]\.description(\[\d+\])?$"),
    re.compile(r"^additional\.technicalSkills$"),
]

_BLOCKED_PATH_PREFIXES = frozenset({"personalInfo", "customSections", "sectionMeta"})

_BLOCKED_FIELD_NAMES = frozenset({
    "years", "company", "institution", "title", "degree",
    "name", "role", "github", "website", "location", "id",
})


def _sanitize_user_input(text: str) -> str:
    sanitized = text
    for pattern in _INJECTION_PATTERNS:
        sanitized = re.sub(pattern, "[REDACTED]", sanitized, flags=re.IGNORECASE)
    return sanitized


def _is_path_allowed(path: str) -> bool:
    return any(p.match(path) for p in _ALLOWED_PATH_PATTERNS)


def _is_path_blocked(path: str) -> bool:
    for prefix in _BLOCKED_PATH_PREFIXES:
        if path == prefix or path.startswith(prefix + ".") or path.startswith(prefix + "["):
            return True
    segments = path.split(".")
    if segments:
        last_segment = segments[-1]
        field_name = re.sub(r"\[\d+\]$", "", last_segment)
        if field_name in _BLOCKED_FIELD_NAMES and field_name != "description":
            return True
    if path.startswith("education"):
        return True
    return False


def _resolve_path(data: dict[str, Any], path: str) -> tuple[Any, bool]:
    current: Any = data
    for segment_match in _PATH_SEGMENT_RE.finditer(path):
        key = segment_match.group(1)
        index_str = segment_match.group(2)
        if not isinstance(current, dict) or key not in current:
            return None, False
        current = current[key]
        if index_str is not None:
            index = int(index_str)
            if not isinstance(current, list) or index < 0 or index >= len(current):
                return None, False
            current = current[index]
    return current, True


def _set_at_path(data: dict[str, Any], path: str, value: Any) -> bool:
    segments = list(_PATH_SEGMENT_RE.finditer(path))
    if not segments:
        return False
    current: Any = data
    for seg in segments[:-1]:
        key = seg.group(1)
        index_str = seg.group(2)
        if not isinstance(current, dict) or key not in current:
            return False
        current = current[key]
        if index_str is not None:
            index = int(index_str)
            if not isinstance(current, list) or index < 0 or index >= len(current):
                return False
            current = current[index]
    last = segments[-1]
    key = last.group(1)
    index_str = last.group(2)
    if index_str is not None:
        if not isinstance(current, dict) or key not in current:
            return False
        target = current[key]
        index = int(index_str)
        if not isinstance(target, list) or index < 0 or index >= len(target):
            return False
        target[index] = value
    else:
        if not isinstance(current, dict):
            return False
        current[key] = value
    return True


async def extract_job_keywords(job_description: str) -> dict[str, Any]:
    """Extract structured keywords from a job description."""
    sanitized = _sanitize_user_input(job_description)
    prompt = EXTRACT_KEYWORDS_PROMPT.format(job_description=sanitized)
    result = await complete_json(
        prompt=prompt,
        system_prompt="You are a JSON extraction engine. Output only valid JSON.",
    )
    return result


def apply_diffs(
    original: dict[str, Any],
    changes: list[dict[str, Any]],
) -> dict[str, Any]:
    """Apply a list of targeted diffs to a resume dict."""
    data = copy.deepcopy(original)
    applied = 0
    skipped = 0

    for change in changes:
        path = change.get("path", "")
        action = change.get("action", "replace")
        value = change.get("value")
        original_text = change.get("original")

        if not path:
            skipped += 1
            continue

        if _is_path_blocked(path):
            logger.warning("Blocked path in diff: %s", path)
            skipped += 1
            continue

        if not _is_path_allowed(path):
            logger.warning("Path not in whitelist: %s", path)
            skipped += 1
            continue

        if action == "replace":
            current_val, found = _resolve_path(data, path)
            if not found:
                skipped += 1
                continue
            if original_text is not None and isinstance(current_val, str):
                if current_val.strip() != str(original_text).strip():
                    logger.warning("Original mismatch at %s", path)
                    skipped += 1
                    continue
            if _set_at_path(data, path, value):
                applied += 1
            else:
                skipped += 1

        elif action == "append":
            parent_path = re.sub(r"\[\d+\]$", "", path)
            parent, found = _resolve_path(data, parent_path)
            if found and isinstance(parent, list):
                parent.append(value)
                applied += 1
            else:
                skipped += 1

        elif action == "reorder":
            if isinstance(value, list):
                if _set_at_path(data, path, value):
                    applied += 1
                else:
                    skipped += 1
            else:
                skipped += 1

    logger.info("Diffs applied: %d, skipped: %d", applied, skipped)
    return data


async def generate_resume_diffs(
    original_resume: dict[str, Any],
    job_description: str,
    job_keywords: dict[str, Any],
    prompt_id: str = DEFAULT_IMPROVE_PROMPT_ID,
    output_language: str = "English",
) -> dict[str, Any]:
    """Generate targeted diff changes via LLM."""
    sanitized_jd = _sanitize_user_input(job_description)
    jd_truncated = sanitized_jd[:2000]

    strategy = DIFF_STRATEGY_INSTRUCTIONS.get(prompt_id, DIFF_STRATEGY_INSTRUCTIONS["keywords"])

    resume_json = json.dumps(original_resume, indent=2)
    if len(resume_json) > 8000:
        resume_json = resume_json[:8000] + "\n... (truncated)"

    prompt = DIFF_IMPROVE_PROMPT.format(
        strategy_instruction=strategy,
        output_language=output_language,
        job_keywords=json.dumps(job_keywords, indent=2),
        job_description=jd_truncated,
        original_resume=resume_json,
    )

    result = await complete_json(
        prompt=prompt,
        system_prompt="You are a resume improvement engine. Output only valid JSON.",
        max_tokens=2048,
    )
    return result


def _preserve_personal_info(
    tailored: dict[str, Any],
    original: dict[str, Any],
) -> dict[str, Any]:
    """Always restore personal info from original (LLM may strip it)."""
    tailored["personalInfo"] = copy.deepcopy(original.get("personalInfo", {}))
    return tailored


# ---------------------------------------------------------------------------
# ATS Boost pass — post-tailoring score maximization
# ---------------------------------------------------------------------------

_ATS_ACTION_VERBS = frozenset({
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

_METRIC_RE_BOOST = re.compile(r"\d+\s*(?:%|x|X|\+|k\b|K\b|M\b|B\b|\$|ms\b|s\b|~)")
_NUMBER_RE_BOOST = re.compile(r"\b~?\d[\d,]*(?:\.\d+)?\b")


def _collect_boost_targets(resume: dict[str, Any]) -> tuple[list[tuple[str, str]], list[tuple[str, str]]]:
    """Return (weak_verb_bullets, weak_quant_bullets) as (path, text) tuples."""
    weak_verb: list[tuple[str, str]] = []
    weak_quant: list[tuple[str, str]] = []

    def _check(path: str, text: str) -> None:
        if not text or not text.strip():
            return
        first_word = text.strip().split()[0].lower().rstrip(".,;:")
        if first_word not in _ATS_ACTION_VERBS:
            weak_verb.append((path, text))
        has_metric = bool(_METRIC_RE_BOOST.search(text) or _NUMBER_RE_BOOST.search(text))
        if not has_metric:
            weak_quant.append((path, text))

    for i, exp in enumerate(resume.get("workExperience", [])):
        for j, bullet in enumerate(exp.get("description", [])):
            _check(f"workExperience[{i}].description[{j}]", bullet)

    for i, proj in enumerate(resume.get("personalProjects", [])):
        for j, bullet in enumerate(proj.get("description", [])):
            _check(f"personalProjects[{i}].description[{j}]", bullet)

    return weak_verb, weak_quant


def _build_context_summary(resume: dict[str, Any]) -> str:
    """Build a short role/tech summary for the quantification prompt."""
    parts: list[str] = []
    info = resume.get("personalInfo", {})
    if info.get("title"):
        parts.append(f"Role: {info['title']}")
    for exp in resume.get("workExperience", [])[:3]:
        parts.append(f"- {exp.get('title', '')} at {exp.get('company', '')} ({exp.get('years', '')})")
    skills = resume.get("additional", {}).get("technicalSkills", [])
    if skills:
        parts.append("Skills: " + ", ".join(skills[:15]))
    return "\n".join(parts) or "Software engineer"


async def run_ats_boost_pass(
    resume: dict[str, Any],
    missing_keywords: list[str],
    current_score: float,
) -> dict[str, Any]:
    """Pass 1: fix action verbs + inject missing keywords (fast, few changes)."""
    weak_verb_bullets, _ = _collect_boost_targets(resume)
    weak_verb_sample = weak_verb_bullets[:12]

    if not weak_verb_sample and not missing_keywords:
        logger.info("ATS boost pass 1: nothing to fix, skipping")
        return resume

    # Compact resume JSON — only bullets + skills, no personalInfo bloat
    compact = {
        "summary": resume.get("summary", ""),
        "workExperience": resume.get("workExperience", []),
        "personalProjects": resume.get("personalProjects", []),
        "additional": resume.get("additional", {}),
    }
    resume_json = json.dumps(compact)
    if len(resume_json) > 9000:
        resume_json = resume_json[:9000] + "\n... (truncated)"

    def _fmt_bullets(items: list[tuple[str, str]]) -> str:
        return "\n".join(f'  {path}: "{text}"' for path, text in items) or "  (none)"

    prompt = ATS_BOOST_PROMPT.format(
        current_score=current_score,
        missing_keywords=", ".join(missing_keywords) if missing_keywords else "(none)",
        weak_verb_bullets=_fmt_bullets(weak_verb_sample),
        weak_quant_bullets="(handled in separate pass)",
        resume_json=resume_json,
    )

    try:
        result = await complete_json(
            prompt=prompt,
            system_prompt="You are an ATS resume optimization engine. Output only valid JSON.",
            max_tokens=2500,
        )
    except Exception as e:
        logger.warning("ATS boost pass 1 failed: %s", e)
        return resume

    changes = result.get("changes", [])
    if changes:
        resume = apply_diffs(resume, changes)
        resume = _preserve_personal_info(resume, resume)
        logger.info("ATS boost pass 1 applied %d change(s)", len(changes))
    return resume


async def run_quantification_pass(
    resume: dict[str, Any],
    batch_size: int = 18,
) -> dict[str, Any]:
    """Pass 2: dedicated quantification — adds numbers to ALL unquantified bullets.

    Splits into multiple LLM calls if there are many bullets to ensure complete coverage.
    """
    _, weak_quant_bullets = _collect_boost_targets(resume)

    if not weak_quant_bullets:
        logger.info("Quantification pass: all bullets already quantified")
        return resume

    context_summary = _build_context_summary(resume)
    total_fixed = 0

    # Process in batches so every bullet gets attention
    for batch_start in range(0, len(weak_quant_bullets), batch_size):
        batch = weak_quant_bullets[batch_start: batch_start + batch_size]

        def _fmt(items: list[tuple[str, str]]) -> str:
            return "\n".join(f'  {path}: "{text}"' for path, text in items)

        prompt = QUANTIFY_BULLETS_PROMPT.format(
            context_summary=context_summary,
            weak_quant_bullets=_fmt(batch),
        )

        try:
            result = await complete_json(
                prompt=prompt,
                system_prompt="You are a resume quantification engine. Output only valid JSON.",
                max_tokens=4096,
            )
        except Exception as e:
            logger.warning("Quantification pass batch %d failed: %s", batch_start, e)
            continue

        changes = result.get("changes", [])
        if changes:
            resume = apply_diffs(resume, changes)
            total_fixed += len(changes)
            logger.info(
                "Quantification batch %d-%d: applied %d change(s)",
                batch_start, batch_start + len(batch), len(changes),
            )
        # Re-collect targets so next batch doesn't re-process already-fixed bullets
        _, weak_quant_bullets = _collect_boost_targets(resume)
        if not weak_quant_bullets:
            break

    resume = _preserve_personal_info(resume, resume)
    logger.info("Quantification pass total: %d change(s) applied", total_fixed)
    return resume
