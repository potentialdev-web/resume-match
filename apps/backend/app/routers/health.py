"""Health check routes."""

from typing import Any

from fastapi import APIRouter

from app.llm import check_llm_health

router = APIRouter(tags=["health"])


@router.get("/health")
async def health_check() -> dict[str, Any]:
    """Basic health check."""
    llm_status = await check_llm_health()
    return {
        "status": "ok",
        "llm": llm_status,
    }
