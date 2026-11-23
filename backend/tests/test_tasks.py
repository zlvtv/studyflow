import pytest
from sqlalchemy.exc import OperationalError

from app.database import get_db
from app.main import app

TASK = {
    "title": "Лабораторная работа 1",
    "subject": "Базы данных",
    "due_date": "2026-12-01",
    "priority": "high",
    "description": "Составить ER-диаграмму",
}


def test_crud_and_completion(client):
    response = client.post("/api/tasks", json=TASK)
    assert response.status_code == 201
    task = response.json()
    assert task["status"] == "todo"
    assert task["id"] > 0
    assert client.get(f"/api/tasks/{task['id']}").json()["title"] == TASK["title"]
    updated = client.put(f"/api/tasks/{task['id']}", json={**TASK, "title": "Новый заголовок"})
    assert updated.status_code == 200
    assert updated.json()["title"] == "Новый заголовок"
    done = client.patch(f"/api/tasks/{task['id']}/status", json={"status": "done"})
    assert done.json()["status"] == "done"
    assert client.get("/api/tasks", params={"status": "todo"}).json() == []
    assert client.delete(f"/api/tasks/{task['id']}").status_code == 204
    assert client.get("/api/tasks").json() == []


def test_filter_search_and_order(client):
    client.post("/api/tasks", json=TASK)
    client.post("/api/tasks", json={**TASK, "subject": "DevOps", "due_date": "2026-11-01"})
    client.post("/api/tasks", json={**TASK, "subject": "DevOps", "status": "done"})
    assert client.get("/api/tasks").json()[0]["due_date"] == "2026-11-01"
    assert len(client.get("/api/tasks", params={"subject": "DevOps"}).json()) == 2
    filtered = client.get("/api/tasks", params={"subject": "DevOps", "status": "done"}).json()
    assert len(filtered) == 1 and filtered[0]["status"] == "done"
    assert len(client.get("/api/tasks", params={"q": "DevOps"}).json()) == 2
    assert client.get("/api/tasks", params={"subject": "Нет такого"}).json() == []


def test_search_wildcards_are_literal(client):
    client.post("/api/tasks", json=TASK)
    assert client.get("/api/tasks", params={"q": "%"}).json() == []
    assert client.get("/api/tasks", params={"q": "_"}).json() == []


@pytest.mark.parametrize(
    "patch",
    [
        {"title": "   "},
        {"subject": ""},
        {"due_date": "2026-02-30"},
        {"priority": "urgent"},
        {"status": "unknown"},
        {"title": "x" * 201},
        {"description": "x" * 5001},
        {"subject": None},
        {"id": 42},
    ],
)
def test_invalid_data(client, patch):
    assert client.post("/api/tasks", json={**TASK, **patch}).status_code == 422
    assert client.get("/api/tasks").json() == []


def test_trimming_and_past_deadlines(client):
    response = client.post(
        "/api/tasks", json={**TASK, "title": "  Работа  ", "due_date": "2020-01-01"}
    )
    assert response.status_code == 201
    assert response.json()["title"] == "Работа"


def test_missing_task_and_invalid_status(client):
    assert client.get("/api/tasks/99999").status_code == 404
    assert client.put("/api/tasks/99999", json=TASK).status_code == 404
    assert client.patch("/api/tasks/99999/status", json={"status": "done"}).status_code == 404
    assert client.delete("/api/tasks/99999").status_code == 404
    assert client.get("/api/tasks", params={"status": "other"}).status_code == 422
    assert client.patch("/api/tasks/1/status", json={"status": None}).status_code == 422


def test_health(client):
    assert client.get("/health").json()["status"] == "ok"


def test_unhealthy_database(client):
    class BrokenSession:
        def execute(self, _):
            raise OperationalError("SELECT 1", {}, Exception("offline"))

    app.dependency_overrides[get_db] = lambda: BrokenSession()
    response = client.get("/health")
    assert response.status_code == 503
    assert "offline" not in response.text
