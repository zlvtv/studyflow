from datetime import date, datetime
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field


class Priority(StrEnum):
    low = "low"
    medium = "medium"
    high = "high"


class Status(StrEnum):
    todo = "todo"
    in_progress = "in_progress"
    done = "done"


class TaskInput(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    title: str = Field(min_length=1, max_length=200)
    subject: str = Field(min_length=1, max_length=100)
    description: str = Field(default="", max_length=5000)
    due_date: date
    priority: Priority = Priority.medium
    status: Status = Status.todo


class TaskOutput(TaskInput):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime


class StatusInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    status: Status
