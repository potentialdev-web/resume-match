#!/bin/bash
set -e

# Start backend (always on internal port 8000)
cd /app/apps/backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 &

# Start frontend
# PORT is set by Railway/cloud platforms; defaults to 3000 locally
cd /app/apps/frontend
HOSTNAME=0.0.0.0 PORT="${PORT:-3000}" BACKEND_ORIGIN=http://127.0.0.1:8000 \
  node server.js &

wait
