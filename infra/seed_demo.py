"""Explicit opt-in demo data. Does not change or delete existing tasks."""

import argparse
import json
from datetime import date, timedelta
from urllib.request import Request, urlopen

parser = argparse.ArgumentParser(description="Добавить учебные примеры через StudyFlow API")
parser.add_argument("--url", default="http://127.0.0.1:8088")
args = parser.parse_args()
today = date.today()
examples = [
    (
        "Подготовить лабораторную работу № 3",
        "Базы данных",
        -1,
        "high",
        "todo",
        "SQL-запросы и отчёт по результатам",
    ),
    (
        "Настроить pipeline для StudyFlow",
        "DevOps",
        0,
        "high",
        "in_progress",
        "Проверки, сборка и автоматическое обновление",
    ),
    (
        "Решить задачи по графам",
        "Дискретная математика",
        2,
        "medium",
        "todo",
        "Задания 4–8 из практикума",
    ),
    ("Повторить времена в английском", "Английский язык", 4, "low", "todo", ""),
    ("Подготовить схему архитектуры", "DevOps", -2, "medium", "done", ""),
    (
        "Сдать практическую работу № 2",
        "Базы данных",
        6,
        "medium",
        "todo",
        "Нормализация отношений",
    ),
]
with urlopen(args.url + "/api/tasks", timeout=10) as response:
    existing = {(task["title"], task["subject"]) for task in json.load(response)}
for title, subject, offset, priority, status, description in examples:
    if (title, subject) in existing:
        continue
    payload = {
        "title": title,
        "subject": subject,
        "due_date": str(today + timedelta(days=offset)),
        "priority": priority,
        "status": status,
        "description": description,
    }
    request = Request(
        args.url + "/api/tasks",
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urlopen(request, timeout=10) as response:
        print("Added:", json.load(response)["title"])
