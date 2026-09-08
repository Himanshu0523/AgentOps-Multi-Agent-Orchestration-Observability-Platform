from typing import Dict, Any, List
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from app.config.settings import settings
from app.graph.state import AgentState, Subtask
from app.services.trace_manager import trace_manager
from app.rag.context_builder import build_rag_context
from datetime import datetime
import logging
import json

logger = logging.getLogger(__name__)

class PlannerNode:
    """Planner agent - breaks down goal into subtasks with dependency tracking"""
    
    def __init__(self):
        self._llm = None

    @property
    def llm(self):
        if self._llm is None and settings.openai_api_key and settings.openai_api_key != "your-openai-api-key":
            try:
                self._llm = ChatOpenAI(
                    model=settings.openai_model,
                    temperature=0.3,
                    api_key=settings.openai_api_key
                )
            except Exception as e:
                logger.warning(f"Could not initialize ChatOpenAI: {e}")
        return self._llm
    
    async def plan(self, state: AgentState) -> AgentState:
        """Generate subtasks from goal"""
        logger.info(f"Planning for task: {state.get('task_id')}")
        task_id = state.get("task_id", "")
        goal = state.get("goal", "")
        
        # Create agent run for planner
        agent_run_id = trace_manager.create_agent_run(
            task_id=task_id,
            agent_name="planner",
            parent_run_id=None,
            input_data={"goal": goal, "description": state.get("description")}
        )
        
        # Create trace step for planning start
        trace_manager.create_trace_step(
            task_id=task_id,
            agent_run_id=agent_run_id,
            parent_run_id=None,
            step_type="action",
            content={"message": "Planning started", "agent": "planner", "goal": goal},
            order=1
        )

        # Retrieve relevant RAG context from Qdrant
        rag_context = ""
        try:
            rag_context = await build_rag_context(goal, top_k=2)
            if rag_context:
                trace_manager.create_trace_step(
                    task_id=task_id,
                    agent_run_id=agent_run_id,
                    parent_run_id=None,
                    step_type="observation",
                    content={
                        "message": "Retrieved relevant domain knowledge from Qdrant RAG",
                        "context_preview": rag_context[:250]
                    },
                    order=2
                )
        except Exception as e:
            logger.warning(f"RAG retrieval skipped in planner: {e}")
        
        subtasks: List[Subtask] = []
        try:
            if self.llm:
                prompt = ChatPromptTemplate.from_messages([
                    ("system", """You are a task planner. Break down the goal into subtasks.
                    Assign each subtask to the appropriate agent:
                    - research: For research, information gathering, analysis
                    - coding: For code generation, technical implementation
                    
                    Return JSON array with:
                    - id: unique identifier (e.g. 'subtask-1')
                    - type: 'research' or 'coding'
                    - description: clear description
                    - dependencies: list of subtask IDs that must complete first
                    """),
                    ("user", "Goal: {goal}\n\nRelevant Knowledge Base Context:\n{context}")
                ])
                chain = prompt | self.llm
                result = await chain.ainvoke({"goal": goal, "context": rag_context or "None"})
                
                try:
                    parsed = json.loads(result.content)
                    if isinstance(parsed, list):
                        subtasks = parsed
                    elif isinstance(parsed, dict) and "subtasks" in parsed:
                        subtasks = parsed["subtasks"]
                except Exception:
                    pass
            
            # Intelligent fallback if LLM is not configured or didn't return valid JSON
            if not subtasks:
                subtasks = [
                    {
                        "id": "subtask-1",
                        "type": "research",
                        "description": f"Investigate core requirements, architecture patterns, and technical feasibility for: {goal}",
                        "dependencies": [],
                        "status": "pending",
                        "result": None,
                        "agent_run_id": None
                    },
                    {
                        "id": "subtask-2",
                        "type": "coding",
                        "description": f"Implement modular production-grade solution code and unit verification for: {goal}",
                        "dependencies": ["subtask-1"],
                        "status": "pending",
                        "result": None,
                        "agent_run_id": None
                    }
                ]
            else:
                for s in subtasks:
                    s["status"] = "pending"
                    s["result"] = None
                    s["agent_run_id"] = None
            
            state["subtasks"] = subtasks
            state["current_step"] = "planning_complete"
            state["active_agent"] = "planner"
            
            # Update agent run
            trace_manager.update_agent_run(
                agent_run_id=agent_run_id,
                output={"subtasks": subtasks, "count": len(subtasks)},
                status="completed"
            )
            
            # Trace step for completion
            trace_manager.create_trace_step(
                task_id=task_id,
                agent_run_id=agent_run_id,
                parent_run_id=None,
                step_type="result",
                content={
                    "message": f"Decomposed goal into {len(subtasks)} subtasks",
                    "subtasks_count": len(subtasks),
                    "subtasks": subtasks
                },
                order=2
            )
            
        except Exception as e:
            logger.error(f"Planning error: {e}")
            if "errors" not in state:
                state["errors"] = []
            state["errors"].append(f"Planning error: {e}")
            state["current_step"] = "planning_error"
            
            trace_manager.update_agent_run(
                agent_run_id=agent_run_id,
                status="failed",
                error=str(e)
            )
            trace_manager.create_trace_step(
                task_id=task_id,
                agent_run_id=agent_run_id,
                parent_run_id=None,
                step_type="error",
                content={"message": f"Planning error: {e}"},
                order=2
            )
        
        # Pick initial executable subtask
        state["current_subtask_id"] = None
        for s in state.get("subtasks", []):
            if not s.get("dependencies"):
                state["current_subtask_id"] = s["id"]
                break
        if not state.get("current_subtask_id") and state.get("subtasks"):
            state["current_subtask_id"] = state["subtasks"][0]["id"]

        state["updated_at"] = datetime.now()
        return state
    
    async def route_next(self, state: AgentState) -> str:
        """Route to next agent based on state's current_subtask_id or reviewer"""
        if state.get("status") == "waiting_approval":
            return "waiting_approval"
            
        current_id = state.get("current_subtask_id")
        subtasks = state.get("subtasks", [])
        
        if not current_id:
            return "reviewer"
            
        current = next((s for s in subtasks if s["id"] == current_id), None)
        if not current or current.get("status") == "completed":
            return "reviewer"
            
        return "coding" if current.get("type") == "coding" else "research"

planner_node = PlannerNode()
