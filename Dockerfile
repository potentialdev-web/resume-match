# ── Stage 1: Build frontend ────────────────────────────────────────────────
FROM node:22-slim AS frontend-builder
WORKDIR /app/apps/frontend

COPY apps/frontend/package.json ./
RUN npm install --frozen-lockfile 2>/dev/null || npm install

COPY apps/frontend ./
# Ensure public/ always exists so the COPY in the runtime stage never fails
RUN mkdir -p public
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
        sqlmodel litellm "markitdown[docx]" "pdfminer.six" playwright python-docx python-dotenv PyJWT

# Playwright browser
RUN python -m playwright install chromium --with-deps 2>/dev/null || true

# Backend source
COPY apps/backend ./apps/backend

# Frontend build output
COPY --from=frontend-builder /app/apps/frontend/.next/standalone ./apps/frontend
COPY --from=frontend-builder /app/apps/frontend/.next/static ./apps/frontend/.next/static
COPY --from=frontend-builder /app/apps/frontend/public ./apps/frontend/public

# Only expose the frontend port.
# Railway routes external traffic here; backend (8000) stays internal.
EXPOSE 3000

# Start backend first, wait until it's healthy, then start frontend.
# Inlined in CMD (not a separate script) so it can never be served stale from cache.
CMD bash -c "\
  cd /app/apps/backend && \
  python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 & \
  echo 'Waiting for backend...' && \
  for i in \$(seq 1 90); do \
    curl -sf http://127.0.0.1:8000/api/v1/health > /dev/null 2>&1 && \
    echo \"Backend ready after \${i}s — starting frontend\" && break; \
    sleep 1; \
  done && \
  cd /app/apps/frontend && \
  HOSTNAME=0.0.0.0 PORT=\${PORT:-3000} BACKEND_ORIGIN=http://127.0.0.1:8000 node server.js"
