"""LLM configuration routes."""

import json
from typing import Any

from fastapi import APIRouter, HTTPException

from app.config import (
    delete_api_key_from_config,
    get_api_keys_from_config,
    load_config_file,
    save_api_keys_to_config,
    save_config_file,
)
from app.llm import check_llm_health, get_llm_config
from app.schemas.models import LLMConfigRequest, LLMConfigResponse

router = APIRouter(prefix="/config", tags=["config"])


@router.get("/llm")
def get_llm_config_route() -> LLMConfigResponse:
    """Get current LLM configuration."""
    cfg = get_llm_config()
    return LLMConfigResponse(
        provider=cfg.provider,
        model=cfg.model,
        api_key_set=bool(cfg.api_key),
        api_base=cfg.api_base,
    )


@router.put("/llm")
def update_llm_config(body: LLMConfigRequest) -> dict[str, Any]:
    """Update LLM configuration."""
    config = load_config_file()
    config["provider"] = body.provider
    config["model"] = body.model
    if body.api_key:
        api_keys = config.get("api_keys", {})
        api_keys[body.provider] = body.api_key
        config["api_keys"] = api_keys
    if body.api_base is not None:
        config["api_base"] = body.api_base
    save_config_file(config)
    return {"success": True, "provider": body.provider, "model": body.model}


@router.post("/llm/test")
async def test_llm_connection() -> dict[str, Any]:
    """Test the current LLM connection."""
    result = await check_llm_health(include_details=True)
    return result


@router.get("/api-keys")
def list_api_keys() -> dict[str, Any]:
    """List configured providers (masks keys)."""
    keys = get_api_keys_from_config()
    return {
        "providers": {
            provider: "***" + key[-4:] if key else ""
            for provider, key in keys.items()
        }
    }


@router.post("/api-keys")
def save_api_key(body: dict[str, Any]) -> dict[str, Any]:
    """Save an API key for a provider."""
    provider = body.get("provider", "")
    key = body.get("api_key", "")
    if not provider or not key:
        raise HTTPException(status_code=400, detail="provider and api_key are required")
    keys = get_api_keys_from_config()
    keys[provider] = key
    save_api_keys_to_config(keys)

    # Also update the provider/model in config
    config = load_config_file()
    if body.get("model"):
        config["model"] = body["model"]
    config["provider"] = provider
    if not config.get("api_keys"):
        config["api_keys"] = {}
    config["api_keys"][provider] = key
    save_config_file(config)

    return {"success": True}


@router.delete("/api-keys/{provider}")
def delete_api_key(provider: str) -> dict[str, Any]:
    """Delete a provider's API key."""
    delete_api_key_from_config(provider)
    return {"success": True}
