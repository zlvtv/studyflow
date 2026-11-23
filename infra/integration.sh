#!/usr/bin/env bash
# Separate project, image names and a free host port for every test run.
set -Eeuo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT"
: "${STUDYFLOW_DEPLOY_DIR:?Set an empty temporary deployment directory}"
case "$STUDYFLOW_DEPLOY_DIR" in /*) ;; *) echo "Deploy directory must be absolute" >&2; exit 2;; esac
export APP_TAG=${APP_TAG:-integration}
export COMPOSE_PROJECT_NAME="studyflow-test-$$"
export IMAGE_PREFIX="$COMPOSE_PROJECT_NAME"
export APP_PORT=0
export STUDYFLOW_WAIT_SECONDS=30
umask 077
mkdir -p "$STUDYFLOW_DEPLOY_DIR" reports
[ ! -e "$STUDYFLOW_DEPLOY_DIR/.env" ] || { echo "Integration needs an empty runtime directory" >&2; exit 2; }
printf 'POSTGRES_PASSWORD=test-only\nAPP_PORT=0\n' > "$STUDYFLOW_DEPLOY_DIR/.env"
source "$ROOT/infra/lib.sh"
cleanup() {
    result=$?
    trap - EXIT
    dc logs --no-color --tail 150 > "$ROOT/reports/compose.log" 2>&1 || true
    dc down -v >/dev/null 2>&1 || true
    exit "$result"
}
trap cleanup EXIT
dc build
initial=$APP_TAG
bash infra/deploy.sh "$initial"
port=$(dc port frontend 80)
url="http://127.0.0.1:${port##*:}"
python3 infra/seed_demo.py --url "$url"
before=$(curl -fsS "$url/api/tasks")
dc up -d --no-build --force-recreate --wait --wait-timeout 90 db backend frontend
port=$(dc port frontend 80)
url="http://127.0.0.1:${port##*:}"
[ "$before" = "$(curl -fsS "$url/api/tasks")" ] || { echo "Tasks changed after container recreation" >&2; exit 1; }
bash infra/backup.sh
backup=$(find "$STATE/backups" -name '*.dump' | sort | tail -n 1)
bash infra/restore-test.sh "$backup"

docker tag "$IMAGE_PREFIX/backend:$initial" "$IMAGE_PREFIX/backend:next"
docker tag "$IMAGE_PREFIX/frontend:$initial" "$IMAGE_PREFIX/frontend:next"
bash infra/deploy.sh next
bash infra/rollback.sh
[ "$(cat "$STATE/current-tag")" = "$initial" ]

# Migration still runs, but the new API process exits immediately.
printf 'FROM %s/backend:%s\nCMD ["python", "-c", "raise SystemExit(1)"]\n' "$IMAGE_PREFIX" "$initial" |
    docker build -f - -t "$IMAGE_PREFIX/backend:broken" .
docker tag "$IMAGE_PREFIX/frontend:$initial" "$IMAGE_PREFIX/frontend:broken"
if bash infra/deploy.sh broken; then
    echo "Broken release was accepted" >&2
    exit 1
fi
[ "$(cat "$STATE/current-tag")" = "$initial" ]
export APP_TAG=$initial
verify_http
port=$(dc port frontend 80)
[ "$(curl -fsS "http://127.0.0.1:${port##*:}/api/tasks")" = "$before" ]
echo "Persistence, backup restoration, manual rollback and failed-release recovery passed"
