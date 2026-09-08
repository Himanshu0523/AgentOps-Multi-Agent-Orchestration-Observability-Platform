from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime
from enum import Enum

class TaskStatus(str, Enum):
    PENDING = "pending"
    QUEUED = "queued"
    RUNNING = "running"
    WAITING_APPROVAL = "waiting_approval"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    BUDGET_EXCEEDED = "budget_exceeded"

class Budget(BaseModel):
    maxCost: Optional[float] = 10.0
    spentCost: Optional[float] = 0.0
    currency: Optional[str] = "USD"

class TaskConfig(BaseModel):
    model: Optional[str] = "gpt-4"
    temperature: Optional[float] = 0.7
    maxRetries: Optional[int] = 2
    allowCodeExecution: Optional[bool] = False
    tools: Optional[List[str]] = Field(default_factory=list)

class RunTaskRequest(BaseModel):
    """Request schema for running a task, accepting both goal and goal_text"""
    task_id: str
    goal: Optional[str] = None
    goal_text: Optional[str] = None
    description: Optional[str] = None
    budget: Optional[Dict[str, Any]] = Field(default_factory=dict)
    config: Optional[Dict[str, Any]] = Field(default_factory=dict)

    def get_goal(self) -> str:
        return self.goal or self.goal_text or ""

class RunTaskResponse(BaseModel):
    task_id: str
    status: str
    message: Optional[str] = "Task started successfully"
    agent_run_id: Optional[str] = None
    started_at: Optional[datetime] = None

class TaskStatusResponse(BaseModel):
    task_id: str
    status: str
    result: Optional[Any] = None
    error: Optional[Any] = None