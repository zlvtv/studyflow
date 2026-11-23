#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname "$0")/lib.sh"
: "${1:?Usage: bash infra/deploy.sh IMAGE_TAG}"
check_tag "$1"
export APP_TAG=$1
lock_deploy
previous=$(read_tag current-tag)
dc up -d --wait --wait-timeout 90 db
# A first deployment also receives a backup before the initial migration.
backup_db
if dc run --rm --no-deps backend alembic upgrade head &&
   dc up -d --no-build --wait --wait-timeout "$WAIT_SECONDS" && verify_http; then
    if [ -n "$previous" ] && [ "$previous" != "$APP_TAG" ]; then
        printf '%s\n' "$previous" > "$STATE/previous-tag"
    fi
    printf '%s\n' "$APP_TAG" > "$STATE/current-tag"
    echo "Deployment healthy: $APP_TAG"
else
    echo "Deployment failed; retaining database and diagnostic logs" >&2
    dc logs --tail 80 backend frontend >&2 || true
    if [ -n "$previous" ]; then
        export APP_TAG=$previous
        if dc up -d --no-build --wait --wait-timeout "$WAIT_SECONDS" && verify_http; then
            echo "Previous images restored: $previous" >&2
        else
            echo "Previous images could not be restored; inspect the service logs" >&2
        fi
    else
        echo "First deployment: no previous image to restore" >&2
    fi
    exit 1
fi
