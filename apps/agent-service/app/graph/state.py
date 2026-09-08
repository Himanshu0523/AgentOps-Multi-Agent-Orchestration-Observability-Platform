from typing import TypedDict, Optional, List, Dict, Any, Literal
from datetime import datetime

class Subtask(TypedDict, total=False):
    """A subtask created by the planner"""
    id: str
    type: Literal['research', 'coding']
    description: str
    status: Literal['pending', 'running', 'completed', 'failed']
    dependencies: List[str]
    result: Optional[Dict[str, Any]]
    agent_run_id: Optional[str]

class AgentState(TypedDict, total=False):
    """Enhanced state for multi-agent orchestration with tracing"""
    # Task information
    task_id: str
    goal: str
    description: Optional[str]
    
    # Execution state
    status: str
    current_step: str
    errors: List[str]
    
    # Results
    result: Optional[Any]
    
    # Agent information
    active_agent: str
    current_subtask_id: Optional[str]
    subtasks: List[Subtask]
    
    # Trace information
    trace_steps: List[Dict[str, Any]]
    agent_runs: List[Dict[str, Any]]
    trace_counter: int
    
    # Research and code results
    research_results: Dict[str, Any]
    code_results: Dict[str, Any]
    review_result: Optional[Dict[str, Any]]
    
    # Budget
    budget: Dict[str, Any]
    cost: Dict[str, float]
    
    # Control
    retry_count: int
    max_retries: int
    
    # Timing
    started_at: datetime
    updated_at: datetime