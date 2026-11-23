#!/usr/bin/env bash
# Shared only by maintenance commands, never evaluated from untrusted CI input.
set -Eeuo pipefail
umask 077
ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
: "${STUDYFLOW_DEPLOY_DIR:?Set STUDYFLOW_DEPLOY_DIR to a persistent absolute directory}"
case "$STUDYFLOW_DEPLOY_DIR" in /*) ;; *) echo "Deploy directory must be absolute" >&2; exit 2;; esac
STATE=$STUDYFLOW_DEPLOY_DIR
WAIT_SECONDS=${STUDYFLOW_WAIT_SECONDS:-120}
[[ "$WAIT_SECONDS" =~ ^[1-9][0-9]*$ ]] || { echo "Invalid healthcheck timeout" >&2; exit 2; }
mkdir -p "$STATE/backups"
if [ ! -f "$STATE/.env" ]; then
    echo "Copy .env.example to $STATE/.env and set POSTGRES_PASSWORD" >&2
    exit 2
fi
dc() { docker compose --env-file "$STATE/.env" -f "$ROOT/compose.yaml" "$@"; }
read_tag() { cat "$STATE/$1" 2>/dev/null || true; }
check_tag() { [[ "$1" =~ ^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$ ]] || { echo "Invalid image tag" >&2; exit 2; }; }
lock_deploy() {
    if ! mkdir "$STATE/deploy.lock" 2>/dev/null; then
        echo "Another maintenance command holds $STATE/deploy.lock" >&2
        exit 2
    fi
    trap 'rmdir "$STATE/deploy.lock"' EXIT
}
backup_db() {
    local destination="$STATE/backups/$(date -u +%Y%m%dT%H%M%SZ)-${APP_TAG}-$$.dump"
    dc exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$destination.tmp"
    mv "$destination.tmp" "$destination"
    echo "Backup saved: $destination"
}
verify_http() {
    local port health
    port=$(dc port frontend 80)
    port=${port##*:}
    curl --fail --silent --show-error --max-time 10 "http://127.0.0.1:$port/" > /dev/null &&
    health=$(curl --fail --silent --show-error --max-time 10 "http://127.0.0.1:$port/health") &&
    [[ "$health" == *"\"version\":\"$APP_TAG\""* ]] &&
    curl --fail --silent --show-error --max-time 10 "http://127.0.0.1:$port/api/tasks" > /dev/null
}
