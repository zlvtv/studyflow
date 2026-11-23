# Настройка учебного GitLab Runner

Исходники хранятся в личном GitHub `zlvtv`. Для части темы о GitLab создай
отдельный учебный проект GitLab и импортируй репозиторий либо добавь его вторым
remote. Приватный GitHub нельзя импортировать без предоставленного доступа;
не помещай токены в URL коммитов, README или `.gitlab-ci.yml`.

1. Установи GitLab Runner из официальной документации GitLab на **выделенный
   учебный компьютер / VM** с Docker, Compose v2, Bash и curl. Все задания
   сборки и развёртывания должны выполняться на одном Docker-хосте, поскольку
   используются локальные образы без registry.
2. В GitLab открой Settings → CI/CD → Runners → New project runner, задай тег
   `studyflow-course`. Зарегистрируй Runner с executor `shell`. Не используй
   токены или Runner другого проекта. Для публичного репозитория не разрешай
   выполнение недоверенных внешних merge request на этом Runner.
3. Под учётной записью Runner проверь `docker info`, `docker compose version`,
   `bash --version`, `curl --version`. Доступ к Docker даёт широкие права на
   хост, поэтому эта машина предназначена только для учебного проекта.
4. Создай постоянную папку `studyflow-runtime` вне checkout Runner, скопируй
   туда `.env.example` как `.env`, заполни `POSTGRES_PASSWORD`. Доступ к папке
   и файлу оставь только учётной записи Runner (`chmod 700` для папки и
   `chmod 600` для `.env`). Не добавляй их в Git.
5. В переменных CI проекта задай `STUDYFLOW_DEPLOY_DIR`: абсолютный путь к этой
   папке. Используй одну и ту же машину и папку для всех этапов. Значение не
   является секретом; пароль остаётся только на локальном хосте.
6. Основную ветку назови `main`, разреши push/merge доверенному владельцу.
   Обновления из других веток проходят проверки и сборку, но не deploy.
7. Отправь исходники в GitLab. Проверь задания этапов `lint`, `test`, `build`,
   `deploy`, JUnit-отчёты, результат `/health` и совпадение `version` с SHA.

Для учебной проверки блокировки сделай **отдельную ветку** с намеренно
неверным утверждением в одном тесте. Pipeline должен завершиться на `test`,
не выполняя `build_images` и `deploy_local`. Не добавляй заведомо неверный тест
в основную ветку.

После двух успешных версий проверь `bash infra/rollback.sh` и сохранность задач.
Для проверки восстановления используй `restore-test.sh`; он не заменяет
рабочую БД. Тома, образы и резервные копии не очищаются глобальными командами.

Официальные инструкции:

- [Установка GitLab Runner](https://docs.gitlab.com/runner/install/)
- [Docker в shell executor](https://docs.gitlab.com/ci/docker/using_docker_build/)
- [Resource groups](https://docs.gitlab.com/ci/resource_groups/)
- [JUnit-отчёты](https://docs.gitlab.com/ci/testing/unit_test_reports/)
