#!/usr/bin/env bash
set -euo pipefail

APP_DIR=/opt/ispflow
SRC_DIR="$APP_DIR/src"
VENV="$APP_DIR/venv"
BACKEND_DIR="$SRC_DIR/isp-billing-backend-master"

cd "$SRC_DIR"
PREV_COMMIT="$(git rev-parse HEAD)"
echo "$PREV_COMMIT" > /tmp/ispflow-previous-commit
git fetch origin main
git reset --hard origin/main

"$VENV/bin/pip" install -r "$BACKEND_DIR/requirements.prod.txt"
cd "$BACKEND_DIR"
"$VENV/bin/python" -m alembic upgrade head

sudo systemctl restart ispflow-backend.service
sudo systemctl restart ispflow-celery-worker.service
sudo systemctl restart ispflow-celery-beat.service

HEALTH=0
for attempt in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:8000/health >/dev/null; then
    HEALTH=1
    break
  fi
  sleep 2
done

if [ "$HEALTH" != "1" ]; then
  echo "HEALTH_CHECK_FAILED"
  exit 1
fi
echo "HEALTH_OK"
