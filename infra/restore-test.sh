#!/usr/bin/env bash
# Restores into an isolated container and volume; does not touch the live database.
set -Eeuo pipefail
: "${1:?Usage: bash infra/restore-test.sh /absolute/path/backup.dump}"
[ -f "$1" ] || { echo "Backup not found" >&2; exit 2; }
name="studyflow-restore-test-$$"
volume="$name-data"
cleanup() { docker rm -f "$name" >/dev/null 2>&1 || true; docker volume rm "$volume" >/dev/null 2>&1 || true; }
trap cleanup EXIT
docker volume create "$volume" >/dev/null
docker run -d --name "$name" --network none -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB=restorecheck -v "$volume:/var/lib/postgresql/data" postgres:16-alpine >/dev/null
ready=false
for attempt in $(seq 1 30); do
    if docker exec "$name" pg_isready -h 127.0.0.1 -U postgres -d restorecheck >/dev/null 2>&1; then ready=true; break; fi
    sleep 1
done
[ "$ready" = true ] || { echo "Temporary database failed to start" >&2; exit 1; }
docker exec -i "$name" pg_restore -U postgres -d restorecheck --no-owner --no-privileges --exit-on-error < "$1"
docker exec "$name" psql -U postgres -d restorecheck -c 'SELECT count(*) AS restored_tasks FROM tasks;'
echo "Backup restored successfully in an isolated database"
