#!/usr/bin/env bash
# Verify an archive by restoring into a new temporary DB, never the live DB.
set -euo pipefail
cd "$(dirname "$0")/.."
archive="${1:?Pass an absolute backup directory}"
(cd "$archive" && sha256sum --check SHA256SUMS)
tar -tzf "$archive/media.tar.gz" > /dev/null
restore_db="aj_restorecheck_$(date -u +%Y%m%d%H%M%S)_${RANDOM}"
# Name is generated here; callers cannot specify a database to replace.
docker compose exec -T db sh -ec 'createdb -U "$POSTGRES_USER" "$1"' sh "$restore_db"
cleanup() {
  docker compose exec -T db sh -ec 'dropdb -U "$POSTGRES_USER" "$1"' sh "$restore_db"
}
trap cleanup EXIT
docker compose exec -T db sh -ec 'pg_restore --exit-on-error --no-owner --no-acl -U "$POSTGRES_USER" -d "$1"' sh "$restore_db" < "$archive/database.dump"
cleanup
trap - EXIT
echo "Backup restore verified in temporary database"
