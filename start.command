#!/usr/bin/env bash
set -Eeuo pipefail
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
cd "$(dirname "$0")"

failed() {
    echo "Запуск не завершён. Сообщение об ошибке находится выше."
    if [ -t 0 ]; then read -r -p "Нажми Enter, чтобы закрыть окно. " _reply; fi
}
trap failed ERR

if ! docker info >/dev/null 2>&1; then
    echo "Открой Docker Desktop, дождись готовности и повтори запуск."
    exit 1
fi

if [ ! -f .env ]; then
    umask 077
    password=$(openssl rand -hex 24)
    sed "s/^POSTGRES_PASSWORD=$/POSTGRES_PASSWORD=$password/" .env.example > .env
fi
chmod 600 .env
export STUDYFLOW_DEPLOY_DIR="$PWD/.studyflow-runtime/local"
mkdir -p "$STUDYFLOW_DEPLOY_DIR"
if [ ! -f "$STUDYFLOW_DEPLOY_DIR/.env" ]; then
    cp .env "$STUDYFLOW_DEPLOY_DIR/.env"
fi
chmod 600 "$STUDYFLOW_DEPLOY_DIR/.env"
tag=$(sed -n 's/^APP_TAG=//p' "$STUDYFLOW_DEPLOY_DIR/.env" | tail -n 1)
tag=${tag:-dev}
APP_TAG="$tag" docker compose --env-file "$STUDYFLOW_DEPLOY_DIR/.env" build
bash infra/deploy.sh "$tag"
port=$(docker compose --env-file "$STUDYFLOW_DEPLOY_DIR/.env" port frontend 80)
open "http://127.0.0.1:${port##*:}"
echo "StudyFlow работает. Окно терминала можно закрыть."
