"""Resume data normalization utilities (no LLM required).

Handles:
- Date format normalization → "Mon YYYY - Mon YYYY" / "Mon YYYY - Present"
"""

import copy
import re
from typing import Any

# Month number → abbreviation
_MONTH_MAP = {
    "01": "Jan", "1": "Jan",
    "02": "Feb", "2": "Feb",
    "03": "Mar", "3": "Mar",
    "04": "Apr", "4": "Apr",
    "05": "May", "5": "May",
    "06": "Jun", "6": "Jun",
    "07": "Jul", "7": "Jul",
    "08": "Aug", "8": "Aug",
    "09": "Sep", "9": "Sep",
    "10": "Oct",
    "11": "Nov",
    "12": "Dec",
}

# Already valid: "Jan 2020", "January 2020"
_ALREADY_GOOD = re.compile(
    r"(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?"
    r"|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)"
    r"\.?\s+\d{4}",
    re.IGNORECASE,
)

# "Present" / "Current" variants
_PRESENT_RE = re.compile(r"\b(present|current|now|ongoing)\b", re.IGNORECASE)

# Numeric: MM/YYYY or MM-YYYY → "Mon YYYY"
_NUMERIC_DATE_RE = re.compile(r"\b(0?[1-9]|1[0-2])[/\-](20\d{2}|19\d{2})\b")

# Plain year range: "2020 - 2023" or "2020-2023"
_YEAR_ONLY_RE = re.compile(r"\b(20\d{2}|19\d{2})\b")


def _convert_numeric_date(match: re.Match) -> str:
    month_num = match.group(1).lstrip("0") or "0"
    year = match.group(2)
    month_name = _MONTH_MAP.get(month_num, "Jan")
    return f"{month_name} {year}"


def normalize_date_string(raw: str) -> str:
    """Attempt to normalize a single date range string to ATS-friendly format.

    Rules:
    1. "Present"/"Current" → "Present"
    2. "MM/YYYY" → "Mon YYYY"
    3. Strings already containing month names → keep as-is
    4. Plain year-only ranges stay as-is (we can't infer months)
    """
    if not raw or not raw.strip():
        return raw

    result = _PRESENT_RE.sub("Present", raw)

    # Convert numeric month/year pairs
    result = _NUMERIC_DATE_RE.sub(_convert_numeric_date, result)

    # Normalize separator spacing: "2020-2023" → "2020 - 2023"
    result = re.sub(r"\s*[-–—]\s*", " - ", result)
    result = re.sub(r"\s{2,}", " ", result).strip()

    return result


def normalize_resume_dates(resume: dict[str, Any]) -> dict[str, Any]:
    """Return a copy of `resume` with all date/years fields normalized."""
    data = copy.deepcopy(resume)

    for exp in data.get("workExperience", []):
        if exp.get("years"):
            exp["years"] = normalize_date_string(exp["years"])

    for edu in data.get("education", []):
        if edu.get("years"):
            edu["years"] = normalize_date_string(edu["years"])

    for proj in data.get("personalProjects", []):
        if proj.get("years"):
            proj["years"] = normalize_date_string(proj["years"])

    for section in data.get("customSections", {}).values():
        for item in section.get("items") or []:
            if item.get("years"):
                item["years"] = normalize_date_string(item["years"])

    return data
