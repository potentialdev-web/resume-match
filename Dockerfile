# ── Stage 1: Build frontend ────────────────────────────────────────────────
FROM node:22-slim AS frontend-builder
WORKDIR /app/apps/frontend

COPY apps/frontend/package.json ./
RUN npm install --frozen-lockfile 2>/dev/null || npm install

COPY apps/frontend ./
ENV NEXT_PUBLIC_API_URL=/api/v1
RUN npm run build

# ── Stage 2: Python + runtime ─────────────────────────────────────────────
FROM python:3.13-slim AS runtime

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    nodejs npm curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Backend Python deps
COPY apps/backend/pyproject.toml apps/backend/
RUN pip install --no-cache-dir uv && \
    uv pip install --system -r apps/backend/pyproject.toml 2>/dev/null || \
    pip install --no-cache-dir \
        fastapi uvicorn python-multipart pydantic pydantic-settings \
        sqlmodel litellm "markitdown[docx]" "pdfminer.six" playwright python-docx python-dotenv

# Playwright browser
RUN python -m playwright install chromium --with-deps 2>/dev/null || true

# Backend source
COPY apps/backend ./apps/backend

# Frontend build output
COPY --from=frontend-builder /app/apps/frontend/.next/standalone ./apps/frontend
COPY --from=frontend-builder /app/apps/frontend/.next/static ./apps/frontend/.next/static
COPY --from=frontend-builder /app/apps/frontend/public ./apps/frontend/public 2>/dev/null || true

# Start script
COPY docker/start.sh /start.sh
RUN chmod +x /start.sh

EXPOSE 3000 8000

CMD ["/start.sh"]
