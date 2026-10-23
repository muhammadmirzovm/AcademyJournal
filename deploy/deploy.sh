#!/usr/bin/env bash
# Production deployment. CI supplies the exact revision that passed its checks.
set -euo pipefail
umask 077
cd "$(dirname "$0")/.."

# Prevent overlapping manual/CI migrations and backups on the same host.
exec 9>.deploy.lock
flock -n 9 || { echo "ERROR: another deployment is running" >&2; exit 1; }
revision="${1:?Pass the full commit SHA that passed CI}"
[[ "$revision" =~ ^[0-9a-f]{40}$ ]] || { echo "ERROR: full commit SHA required" >&2; exit 1; }
previous_revision="$(git rev-parse HEAD)"
git fetch --prune origin
git merge-base --is-ancestor "$revision" origin/main || { echo "ERROR: revision is not on origin/main" >&2; exit 1; }
git checkout -f -B main "$revision"

echo "==> Validate configuration and build before maintenance"
docker compose config --quiet
docker compose build
docker compose run --rm --no-deps -T --entrypoint python backend manage.py check --deploy --fail-level WARNING

maintenance=false
trap 'if [ "$maintenance" = true ]; then echo "ERROR: deployment stopped during maintenance. Backup is in backups/ (or BACKUP_DIR). Review logs before restarting; do not blindly roll back migrations." >&2; fi' ERR

echo "==> Stop application writers and back up database, media and settings"
maintenance=true
docker compose stop web scheduler backend
PREVIOUS_REVISION="$previous_revision" bash deploy/backup.sh

echo "==> Migrate and audit ownership before accepting traffic"
docker compose run --rm --no-deps -T --entrypoint python backend manage.py migrate --noinput
docker compose run --rm --no-deps -T --entrypoint python backend manage.py audit_tenant_data --strict

echo "==> Start backend and verify database readiness"
docker compose up -d --no-build backend
cid="$(docker compose ps -q backend)"
test -n "$cid"
healthy=false
for i in $(seq 1 40); do
  status="$(docker inspect -f '{{.State.Health.Status}}' "$cid" 2>/dev/null || true)"
  if [ "$status" = healthy ]; then healthy=true; break; fi
  sleep 3
done
[ "$healthy" = true ] || { echo "ERROR: backend readiness timed out" >&2; false; }

echo "==> Start scheduler and web"
docker compose up -d --no-build --force-recreate scheduler web
sleep 10
for service in scheduler web; do
  cid="$(docker compose ps -q "$service")"
  test -n "$cid"
  state="$(docker inspect -f '{{.State.Status}} {{.RestartCount}}' "$cid")"
  [ "$state" = 'running 0' ] || { echo "ERROR: $service is unstable ($state)" >&2; false; }
done
docker compose exec -T web wget -q -O /dev/null http://127.0.0.1/
docker compose exec -T web wget -q -O /dev/null --header='Host: api.journal.crmneo.com' http://127.0.0.1/api/health/
maintenance=false
trap - ERR
docker compose ps
echo "==> Deploy complete: $revision"
