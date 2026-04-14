"""Application configuration."""

import json
from pathlib import Path
from typing import Any, Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

CONFIG_FILE_PATH = Path(__file__).parent.parent / "data" / "config.json"
ALLOWED_LOG_LEVELS = ("CRITICAL", "ERROR", "WARNING", "INFO", "DEBUG")


def load_config_file() -> dict[str, Any]:
    if CONFIG_FILE_PATH.exists():
        try:
            return json.loads(CONFIG_FILE_PATH.read_text())
        except (json.JSONDecodeError, OSError):
            return {}
    return {}


def save_config_file(config: dict[str, Any]) -> None:
    CONFIG_FILE_PATH.parent.mkdir(parents=True, exist_ok=True)
    CONFIG_FILE_PATH.write_text(json.dumps(config, indent=2))


def get_api_keys_from_config() -> dict[str, str]:
    return load_config_file().get("api_keys", {})


def save_api_keys_to_config(api_keys: dict[str, str]) -> None:
    config = load_config_file()
    config["api_keys"] = api_keys
    save_config_file(config)


def delete_api_key_from_config(provider: str) -> None:
    config = load_config_file()
    if "api_keys" in config and provider in config["api_keys"]:
        del config["api_keys"][provider]
        save_config_file(config)


def _get_llm_api_key_with_fallback() -> str:
    import os
    env_key = os.environ.get("LLM_API_KEY", "")
    if env_key:
        return env_key
    config_keys = get_api_keys_from_config()
    provider = os.environ.get("LLM_PROVIDER", "openai")
    provider_map = {
        "openai": "openai",
        "anthropic": "anthropic",
        "gemini": "google",
        "openrouter": "openrouter",
        "deepseek": "deepseek",
        "ollama": "ollama",
    }
    config_provider = provider_map.get(provider, provider)
    return config_keys.get(config_provider, "")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    llm_provider: Literal[
        "openai", "anthropic", "openrouter", "gemini", "deepseek", "ollama"
    ] = "openai"
    llm_model: str = "gpt-4o-mini"
    llm_api_key: str = ""
    llm_api_base: str | None = None
    log_llm: Literal["CRITICAL", "ERROR", "WARNING", "INFO", "DEBUG"] = "WARNING"

    @field_validator("llm_provider", mode="before")
    @classmethod
    def set_default_provider(cls, v: Any) -> str:
        if not v or (isinstance(v, str) and not v.strip()):
            return "openai"
        return v

    @field_validator("log_llm", mode="before")
    @classmethod
    def normalize_log_llm_level(cls, v: Any) -> str:
        value = "WARNING" if not v else str(v).strip().upper()
        if value not in ALLOWED_LOG_LEVELS:
            raise ValueError(f"Invalid LOG_LLM: {value}")
        return value

    # Auth
    jwt_secret: str = "change-me-in-production"
    admin_password: str = "admin"
    allowed_emails: list[str] = [
        "potentialdev69@gmail.com",
        "coding.kei@gmail.com",
        "homeoffer25@gmail.com",
    ]

    host: str = "0.0.0.0"
    port: int = 8000
    log_level: Literal["CRITICAL", "ERROR", "WARNING", "INFO", "DEBUG"] = "INFO"
    frontend_base_url: str = "http://localhost:3000"

    @field_validator("log_level", mode="before")
    @classmethod
    def normalize_log_level(cls, v: Any) -> str:
        value = "INFO" if not v else str(v).strip().upper()
        if value not in ALLOWED_LOG_LEVELS:
            raise ValueError(f"Invalid LOG_LEVEL: {value}")
        return value

    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    @property
    def effective_cors_origins(self) -> list[str]:
        origins = list(self.cors_origins)
        url = self.frontend_base_url.strip().rstrip("/")
        if url and url not in origins:
            origins.append(url)
        return origins

    data_dir: Path = Path(__file__).parent.parent / "data"

    @property
    def db_path(self) -> Path:
        return self.data_dir / "resume_gen.db"

    @property
    def config_path(self) -> Path:
        return self.data_dir / "config.json"

    def get_effective_api_key(self) -> str:
        if self.llm_api_key:
            return self.llm_api_key
        return _get_llm_api_key_with_fallback()


settings = Settings()
