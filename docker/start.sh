#!/bin/bash
set -e

# Start backend on fixed internal port 8000
cd /app/apps/backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 &

# Wait for backend to be ready
echo "Waiting for backend..."
for i in $(seq 1 30); do
  curl -sf http://127.0.0.1:8000/api/v1/health > /dev/null 2>&1 && break
  sleep 1
done
echo "Backend ready after ${i}s — starting frontend"

# Start frontend on fixed port 3000.
# We explicitly set PORT=3000 to override any platform-injected PORT env var
# (e.g. Railway injects PORT=8080) because Railway's public networking is
# configured to route to port 3000 and we run two processes in one container.
cd /app/apps/frontend
HOSTNAME=0.0.0.0 PORT=3000 BACKEND_ORIGIN=http://127.0.0.1:8000 \
  node server.js &

wait
