#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname "$0")/lib.sh"
lock_deploy
current=$(read_tag current-tag)
target=${1:-$(read_tag previous-tag)}
[ -n "$target" ] || { echo "No previous deployment available" >&2; exit 2; }
check_tag "$target"
if [ "$target" = "$current" ]; then
    echo "Version $target is already running"
    exit 0
fi
export APP_TAG=$target
backup_db
if dc up -d --no-build --wait --wait-timeout "$WAIT_SECONDS" && verify_http; then
    printf '%s\n' "$current" > "$STATE/previous-tag"
    printf '%s\n' "$target" > "$STATE/current-tag"
    echo "Rolled back application images to $target; database was not downgraded"
else
    if [ -n "$current" ]; then
        export APP_TAG=$current
        dc up -d --no-build --wait --wait-timeout "$WAIT_SECONDS" && verify_http
    fi
    exit 1
fi
