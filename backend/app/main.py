import logging
import os
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Query, Response, status
from sqlalchemy import or_, select, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Task
from app.schemas import Status, StatusInput, TaskInput, TaskOutput

logger = logging.getLogger(__name__)
app = FastAPI(title="StudyFlow API", version="1.0.0")
DB = Annotated[Session, Depends(get_db)]


def find_task(task_id: int, db: Session) -> Task:
    task = db.get(Task, task_id)
    if task is None:
        raise HTTPException(404, "Задача не найдена")
    return task


@app.get("/health")
def health(db: DB):
    try:
        db.execute(text("SELECT 1"))
    except SQLAlchemyError:
        logger.exception("Database health check failed")
        raise HTTPException(503, "База данных недоступна") from None
    return {"status": "ok", "version": os.getenv("APP_VERSION", "dev")}


@app.get("/api/tasks", response_model=list[TaskOutput])
def list_tasks(
    db: DB,
    subject: Annotated[str | None, Query(max_length=100)] = None,
    status: Status | None = None,
    q: Annotated[str | None, Query(max_length=200)] = None,
):
    query = select(Task)
    if subject is not None:
        query = query.where(Task.subject == subject)
    if status is not None:
        query = query.where(Task.status == status)
    if q and q.strip():
        query = query.where(
            or_(
                Task.title.icontains(q.strip(), autoescape=True),
                Task.subject.icontains(q.strip(), autoescape=True),
            )
        )
    return db.scalars(query.order_by(Task.due_date, Task.id)).all()


@app.post("/api/tasks", response_model=TaskOutput, status_code=status.HTTP_201_CREATED)
def create_task(data: TaskInput, db: DB):
    task = Task(**data.model_dump())
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@app.get("/api/tasks/{task_id}", response_model=TaskOutput)
def get_task(task_id: int, db: DB):
    return find_task(task_id, db)


@app.put("/api/tasks/{task_id}", response_model=TaskOutput)
def update_task(task_id: int, data: TaskInput, db: DB):
    task = find_task(task_id, db)
    for key, value in data.model_dump().items():
        setattr(task, key, value)
    db.commit()
    db.refresh(task)
    return task


@app.patch("/api/tasks/{task_id}/status", response_model=TaskOutput)
def update_status(task_id: int, data: StatusInput, db: DB):
    task = find_task(task_id, db)
    task.status = data.status
    db.commit()
    db.refresh(task)
    return task


@app.delete("/api/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(task_id: int, db: DB):
    db.delete(find_task(task_id, db))
    db.commit()
    return Response(status_code=204)
