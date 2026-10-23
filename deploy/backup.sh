#!/usr/bin/env bash
# Called with application writers stopped. Never prints database credentials.
set -euo pipefail
umask 077
cd "$(dirname "$0")/.."

for service in backend scheduler web; do
  if [ -n "$(docker compose ps --status running -q "$service")" ]; then
    echo "ERROR: stop backend, scheduler and web before taking a consistent backup" >&2
    exit 1
  fi
done

backup_root="${BACKUP_DIR:-$PWD/backups}"
mkdir -p "$backup_root"
backup_dir="$(mktemp -d "$backup_root/$(date -u +%Y%m%dT%H%M%SZ).XXXXXX.partial")"
trap 'echo "ERROR: incomplete backup retained at $backup_dir" >&2' ERR

docker compose exec -T db sh -ec 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$backup_dir/database.dump"
test -s "$backup_dir/database.dump"
docker compose exec -T db pg_restore --list < "$backup_dir/database.dump" > "$backup_dir/database.list"
# Override entrypoint so no migrations or server processes run during archiving.
docker compose run --rm --no-deps -T --entrypoint tar backend -C /app/media -czf - . > "$backup_dir/media.tar.gz"
tar -tzf "$backup_dir/media.tar.gz" > /dev/null
printf '%s\n' "${PREVIOUS_REVISION:-$(git rev-parse HEAD)}" > "$backup_dir/revision.txt"
# Preserve runtime settings for disaster recovery. Directory and files are private.
cp .env "$backup_dir/environment.env"
(cd "$backup_dir" && sha256sum database.dump media.tar.gz environment.env revision.txt > SHA256SUMS)
bash deploy/restore-check.sh "$backup_dir"
completed="${backup_dir%.partial}"
mv "$backup_dir" "$completed"
trap - ERR
echo "Backup complete: $completed"
