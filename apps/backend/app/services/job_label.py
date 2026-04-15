"""Human-readable resume labels from job description text (no extra LLM call)."""

from __future__ import annotations

import re

_SKIP_PREFIXES = (
    "overview",
    "about the role",
    "about us",
    "the role",
    "role overview",
    "responsibilities",
    "requirements",
    "qualifications",
    "must have",
    "nice to have",
    "benefits",
    "what you'll",
    "what you will",
    "description",
    "job summary",
    "summary",
    "location:",
    "remote",
    "hybrid",
    "full-time",
    "full time",
    "part-time",
    "contract",
    "apply now",
    "http",
    "www.",
    "equal opportunity",
    "salary",
    "compensation",
    "years of experience",
    "we are looking",
    "looking for",
)


def display_label_from_jd(job_text: str, max_len: int = 52) -> str:
    """Pick a short label from the first meaningful line(s) of a JD."""
    text = (job_text or "").strip()
    if not text:
        return "Tailored resume"

    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    for line in lines[:30]:
        low = line.lower()
        if any(low.startswith(p) for p in _SKIP_PREFIXES):
            continue
        if line.startswith(("#", "*", "-", "•", "|", ">", "`")):
            continue
        if re.match(r"^[\d.)]+\s+\S", line):
            continue
        if len(line) < 6:
            continue
        if len(line) > 140:
            continue

        clean = re.sub(r"\*{1,2}|__|`", "", line).strip()
        clean = re.sub(r"^\W+", "", clean)
        if len(clean) < 6:
            continue

        if len(clean) <= max_len:
            return clean
        return clean[: max_len - 1].rstrip() + "…"

    first = lines[0] if lines else "Tailored resume"
    first = re.sub(r"\*{1,2}|__|`", "", first).strip()
    if len(first) <= max_len:
        return first or "Tailored resume"
    return first[: max_len - 1].rstrip() + "…"


def safe_filename_stem(label: str, max_len: int = 96) -> str:
    """Safe single-line string for Resume.filename (before .json)."""
    s = (label or "").strip() or "Tailored resume"
    s = re.sub(r'[<>:/\\|?*\x00-\x1f"]', "", s)
    s = re.sub(r"\s+", " ", s).strip(" .")
    if not s:
        s = "Tailored resume"
    return s[:max_len]
