#!/bin/sh
# Backend container entrypoint: wait for DB, apply migrations, then run Daphne.
set -e

echo "[entrypoint] waiting for database ..."
python - <<'PY'
import os, sys, time
import dj_database_url
import psycopg2

cfg = dj_database_url.parse(os.environ["DATABASE_URL"])
for attempt in range(60):
    try:
        psycopg2.connect(
            dbname=cfg["NAME"], user=cfg["USER"], password=cfg["PASSWORD"],
            host=cfg["HOST"], port=cfg.get("PORT") or 5432, connect_timeout=3,
        ).close()
        print("[entrypoint] database is reachable")
        break
    except Exception as exc:
        print(f"[entrypoint] db not ready ({attempt+1}/60): {exc}")
        time.sleep(2)
else:
    print("[entrypoint] database did not become ready in time", file=sys.stderr)
    sys.exit(1)
PY

echo "[entrypoint] applying migrations ..."
python manage.py migrate --noinput

echo "[entrypoint] starting daphne on :8000 ..."
exec daphne -b 0.0.0.0 -p 8000 backend.asgi:application
