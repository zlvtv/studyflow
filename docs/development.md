# Разработка и проверки

Для запуска без контейнеров нужны Python 3.12 и Node.js 22.12+ или 24.
В этом режиме по умолчанию используется файл SQLite `backend/studyflow.db`.
Основной вариант запуска, миграции и интеграционные проверки рассчитаны на PostgreSQL.

Из корня проекта:

```bash
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements-dev.txt
cd backend
alembic upgrade head
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

В другом терминале, из корня проекта:

```bash
cd frontend
npm ci
npm run dev
```

Страница откроется на `http://127.0.0.1:5173`. Vite передаёт запросы `/api/`
на сервер с портом 8000. Для своей PostgreSQL перед запуском Alembic и сервера
задай `DATABASE_URL`, например:

```text
postgresql+psycopg://studyflow:password@127.0.0.1:5432/studyflow
```

В контейнерном запуске строка подключения собирается из отдельных переменных
`POSTGRES_HOST`, `POSTGRES_DB`, `POSTGRES_USER` и `POSTGRES_PASSWORD`.

## Что проверяют тесты

Из `backend` с активированным виртуальным окружением:

```bash
ruff check .
ruff format --check .
pytest -q
alembic check
```

API-тесты создают отдельную SQLite в памяти. Чтобы повторить их на PostgreSQL,
задай `TEST_DATABASE_URL`, направленный на пустую тестовую базу. Каждый тест
получает транзакцию; после него изменения отменяются. Рабочую базу сюда указывать
не нужно. Сценарий `bash infra/ci-backend.sh` сам создаёт временную PostgreSQL
в Docker и дополнительно проверяет миграцию вперёд и назад.

Из `frontend`:

```bash
npm run typecheck
npm test
npm run build
```

`tasks.test.ts` проверяет границы дат, фильтры, порядок и невалидный ввод.
`api.test.ts` — запросы и ошибки соединения. `App.test.tsx` открывает настоящую
React-форму в jsdom: создание, изменение срока, выполнение, удаление и ошибки
сохранения. Сетевые ответы в этих тестах подставлены; браузерную сеть они не проверяют.

Из корня:

```bash
python3 -m unittest discover -s infra/tests -v
```

Эти проверки запускают shell-скрипты с подставной Docker CLI. Они позволяют
воспроизвести ошибку копирования, миграции или запуска без работающего Docker.

## Полная проверка контейнеров

```bash
export STUDYFLOW_DEPLOY_DIR="$(pwd)/.studyflow-runtime/check-$(date +%s)"
bash infra/integration.sh
```

У каждого запуска своё имя Compose-проекта, образы и свободный порт. Скрипт
проверяет пересоздание контейнеров, восстановление копии, ручной откат и отказ
намеренно сломанной версии. В конце удаляются только контейнеры и том этого
тестового проекта. Лог сохраняется в `reports/compose.log` даже при ошибке.

Зависимости зафиксированы в `backend/requirements.lock` и `frontend/package-lock.json`.
После изменения моделей нужна новая ревизия Alembic, а не только правка класса `Task`.
