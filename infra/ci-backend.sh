#!/usr/bin/env bash
set -Eeuo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT"
id="studyflow-ci-${CI_JOB_ID:-$$}"
cleanup() {
    docker rm -f "$id-db" >/dev/null 2>&1 || true
    docker network rm "$id" >/dev/null 2>&1 || true
}
trap cleanup EXIT
mkdir -p reports
docker build --target test -t "$id-tests" backend
docker network create "$id" >/dev/null
docker run -d --rm --name "$id-db" --network "$id" -e POSTGRES_DB=studyflow_test -e POSTGRES_USER=studyflow -e POSTGRES_PASSWORD=test-only postgres:16-alpine >/dev/null
ready=false
for attempt in $(seq 1 45); do
    if docker exec "$id-db" pg_isready -h 127.0.0.1 -U studyflow -d studyflow_test >/dev/null 2>&1; then ready=true; break; fi
    sleep 1
done
[ "$ready" = true ] || { echo "Test PostgreSQL did not start" >&2; exit 1; }
docker run --rm --network "$id" -v "$ROOT/reports:/reports" \
    -e "TEST_DATABASE_URL=postgresql+psycopg://studyflow:test-only@$id-db:5432/studyflow_test" \
    "$id-tests" pytest -q --junitxml=/reports/pytest.xml
# Verify migrations on a second empty test database.
docker exec "$id-db" createdb -U studyflow migration_test
docker run --rm --network "$id" \
    -e "DATABASE_URL=postgresql+psycopg://studyflow:test-only@$id-db:5432/migration_test" \
    "$id-tests" sh -c 'alembic upgrade head && alembic check && alembic downgrade base && alembic upgrade head'
