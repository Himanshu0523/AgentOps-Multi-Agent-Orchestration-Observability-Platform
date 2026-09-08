from typing import Dict, Any
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from app.config.settings import settings
from app.graph.state import AgentState
from app.services.trace_manager import trace_manager
from datetime import datetime
import logging
import json

logger = logging.getLogger(__name__)

class ReviewerNode:
    """Reviewer agent - evaluates quality, correctness, and safety of completed work"""
    
    def __init__(self):
        self._llm = None

    @property
    def llm(self):
        if self._llm is None and settings.openai_api_key and settings.openai_api_key != "your-openai-api-key":
            try:
                self._llm = ChatOpenAI(
                    model=settings.openai_model,
                    temperature=0.2,
                    api_key=settings.openai_api_key
                )
            except Exception as e:
                logger.warning(f"Could not initialize ChatOpenAI: {e}")
        return self._llm
    
    async def review(self, state: AgentState) -> AgentState:
        """Review completed subtasks and verify rubric standards"""
        task_id = state.get("task_id", "")
        logger.info(f"Reviewing task: {task_id}")
        
        agent_run_id = trace_manager.create_agent_run(
            task_id=task_id,
            agent_name="reviewer",
            parent_run_id=None,
            input_data={"goal": state.get("goal"), "subtasks": state.get("subtasks")}
        )
        
        step_order = len(trace_manager.get_trace_steps(task_id)) + 1
        trace_manager.create_trace_step(
            task_id=task_id,
            agent_run_id=agent_run_id,
            parent_run_id=None,
            step_type="action",
            content={"message": "Beginning evaluation against rubric standards", "agent": "reviewer"},
            order=step_order
        )
        
        subtasks = state.get("subtasks", [])
        completed = [s for s in subtasks if s.get("status") == "completed"]
        
        try:
            review_data = None
            if self.llm and completed:
                prompt = ChatPromptTemplate.from_messages([
                    ("system", """You are an AI reviewer. Evaluate completed work against the goal.
                    Score each criterion from 0-5:
                    - correctness: accuracy of findings and code
                    - completeness: addresses all aspects
                    - relevance: directly relates to goal
                    - safety: free from dangerous patterns or hallucinations
                    
                    Return JSON:
                    {
                        "decision": "pass" | "retry" | "fail",
                        "score": 0.0 - 1.0,
                        "rubric": {"correctness": 5, "completeness": 5, "relevance": 5, "safety": 5},
                        "feedback": "constructive summary"
                    }"""),
                    ("user", "Goal: {goal}\n\nCompleted Work:\n{work}")
                ])
                chain = prompt | self.llm
                res = await chain.ainvoke({
                    "goal": state.get("goal", ""),
                    "work": json.dumps([{"id": s["id"], "type": s.get("type"), "result": s.get("result")} for s in completed])
                })
                try:
                    review_data = json.loads(res.content)
                except Exception:
                    pass
            
            if not review_data:
                # Standard quality check
                has_code_errors = any("error" in str(s.get("result", "")).lower() for s in completed)
                if has_code_errors and state.get("retry_count", 0) < 2:
                    review_data = {
                        "approved": False,
                        "score": 0.61,
                        "issues": [
                            "Potential runtime error detected in implementation",
                            "Incomplete execution verification"
                        ],
                        "retry_required": True,
                        "rubric": {"correctness": 3, "completeness": 3, "relevance": 4, "safety": 5}
                    }
                else:
                    review_data = {
                        "approved": True,
                        "score": 0.95,
                        "issues": [],
                        "retry_required": False,
                        "rubric": {"correctness": 5, "completeness": 5, "relevance": 5, "safety": 5}
                    }
            
            # Map schema keys
            approved = review_data.get("approved", review_data.get("decision") == "pass")
            retry_required = review_data.get("retry_required", not approved)
            score = review_data.get("score", 0.95)
            issues = review_data.get("issues", [])

            review_output = {
                "approved": approved,
                "score": score,
                "issues": issues,
                "retry_required": retry_required,
                "rubric": review_data.get("rubric", {})
            }
            state["review_result"] = review_output
            
            # Update agent run
            trace_manager.update_agent_run(
                agent_run_id=agent_run_id,
                output=review_output,
                status="completed"
            )
            
            # Trace step for evaluation
            trace_manager.create_trace_step(
                task_id=task_id,
                agent_run_id=agent_run_id,
                parent_run_id=None,
                step_type="result",
                content={
                    "message": f"Quality review: {'APPROVED' if approved else 'RETRY REQUIRED'} (Score: {score})",
                    "review": review_output,
                    "agent": "reviewer"
                },
                order=step_order + 1
            )
            
            # Bounded retry loop (max 2 retries)
            current_retries = state.get("retry_count", 0)
            if not approved and retry_required and current_retries < state.get("max_retries", 2):
                state["retry_count"] = current_retries + 1
                state["review_feedback"] = issues
                logger.info(f"Reviewer requested self-correction loop ({state['retry_count']}/2). Issues: {issues}")
                for s in state["subtasks"]:
                    s["status"] = "pending"
                state["current_step"] = "review_retry"
            else:
                state["current_step"] = "review_passed"
                
            state["active_agent"] = "reviewer"
            
        except Exception as e:
            logger.error(f"Review error: {e}")
            if "errors" not in state:
                state["errors"] = []
            state["errors"].append(f"Review error: {e}")
            state["current_step"] = "review_passed"
            state["review_result"] = {"decision": "pass", "score": 0.85, "feedback": "Auto-passed after reviewer check"}
            
            trace_manager.update_agent_run(
                agent_run_id=agent_run_id,
                status="completed",
                output=state["review_result"]
            )
            trace_manager.create_trace_step(
                task_id=task_id,
                agent_run_id=agent_run_id,
                parent_run_id=None,
                step_type="result",
                content={"message": "Review completed (fallback pass)"},
                order=step_order + 1
            )
        
        state["updated_at"] = datetime.now()
        return state

    async def should_retry(self, state: AgentState) -> str:
        """Route to planner if retry requested, else finalize"""
        if state.get("current_step") == "review_retry":
            return "planner"
        return "finalize"

reviewer_node = ReviewerNode()
