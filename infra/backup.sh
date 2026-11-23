#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname "$0")/lib.sh"
export APP_TAG=${APP_TAG:-$(read_tag current-tag)}
export APP_TAG=${APP_TAG:-dev}
check_tag "$APP_TAG"
lock_deploy
backup_db
