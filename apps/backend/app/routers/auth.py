"""Authentication routes — email + password login with JWT cookie."""

from __future__ import annotations

import hashlib
import hmac
import json
import time
from typing import Any

from fastapi import APIRouter, Cookie, HTTPException, Response
from pydantic import BaseModel, EmailStr

from app.config import settings

router = APIRouter(prefix="/auth", tags=["auth"])

_JWT_ALG = "HS256"
_TOKEN_EXPIRY = 60 * 60 * 24 * 7  # 7 days
_COOKIE_NAME = "token"


def _b64url_encode(data: bytes) -> str:
    import base64
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _b64url_decode(s: str) -> bytes:
    import base64
    padding = 4 - len(s) % 4
    return base64.urlsafe_b64decode(s + "=" * padding)


def _sign_jwt(payload: dict[str, Any]) -> str:
    header = _b64url_encode(json.dumps({"alg": _JWT_ALG, "typ": "JWT"}).encode())
    body = _b64url_encode(json.dumps(payload).encode())
    sig_input = f"{header}.{body}".encode()
    sig = hmac.new(settings.jwt_secret.encode(), sig_input, hashlib.sha256).digest()
    return f"{header}.{body}.{_b64url_encode(sig)}"


def _verify_jwt(token: str) -> dict[str, Any] | None:
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        sig_input = f"{parts[0]}.{parts[1]}".encode()
        expected = hmac.new(settings.jwt_secret.encode(), sig_input, hashlib.sha256).digest()
        actual = _b64url_decode(parts[2])
        if not hmac.compare_digest(expected, actual):
            return None
        payload = json.loads(_b64url_decode(parts[1]))
        if payload.get("exp", 0) < time.time():
            return None
        return payload
    except Exception:
        return None


def get_current_user(token: str | None = Cookie(None, alias=_COOKIE_NAME)) -> dict[str, Any]:
    """FastAPI dependency — returns user payload or raises 401."""
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = _verify_jwt(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return payload


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


@router.post("/login")
def login(body: LoginRequest, response: Response) -> dict[str, Any]:
    email = body.email.lower().strip()
    allowed = [e.lower().strip() for e in settings.allowed_emails]
    if email not in allowed:
        raise HTTPException(status_code=403, detail="Email not authorized")
    if body.password != settings.admin_password:
        raise HTTPException(status_code=401, detail="Invalid password")

    payload = {"sub": email, "exp": int(time.time()) + _TOKEN_EXPIRY}
    token = _sign_jwt(payload)

    response.set_cookie(
        key=_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=_TOKEN_EXPIRY,
        path="/",
    )
    return {"email": email}


@router.post("/logout")
def logout(response: Response) -> dict[str, str]:
    response.delete_cookie(key=_COOKIE_NAME, path="/")
    return {"status": "ok"}


@router.get("/me")
def me(token: str | None = Cookie(None, alias=_COOKIE_NAME)) -> dict[str, Any]:
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = _verify_jwt(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return {"email": payload["sub"]}
