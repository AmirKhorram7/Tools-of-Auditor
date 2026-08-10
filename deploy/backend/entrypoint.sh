#!/bin/sh
set -e

echo "[entrypoint] waiting for database..."
python - <<'PY'
import os
import time

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "ta_code.settings")
django.setup()

from django.db import connection
from django.db.utils import OperationalError

last_error = None
for attempt in range(60):
    try:
        connection.ensure_connection()
        print("[entrypoint] database is ready")
        break
    except OperationalError as exc:
        last_error = exc
        print(f"[entrypoint] database not ready ({attempt + 1}/60): {exc}")
        time.sleep(2)
else:
    raise SystemExit(f"Database did not become ready in time: {last_error}")
PY

echo "[entrypoint] applying migrations..."
python manage.py migrate --noinput

echo "[entrypoint] collecting static files..."
python manage.py collectstatic --noinput

WORKERS="${GUNICORN_WORKERS:-4}"
THREADS="${GUNICORN_THREADS:-2}"
TIMEOUT="${GUNICORN_TIMEOUT:-60}"

echo "[entrypoint] starting gunicorn (workers=${WORKERS}, threads=${THREADS})..."
exec gunicorn ta_code.wsgi:application \
  --bind 0.0.0.0:8000 \
  --workers "${WORKERS}" \
  --threads "${THREADS}" \
  --timeout "${TIMEOUT}" \
  --access-logfile - \
  --error-logfile - \
  --capture-output
