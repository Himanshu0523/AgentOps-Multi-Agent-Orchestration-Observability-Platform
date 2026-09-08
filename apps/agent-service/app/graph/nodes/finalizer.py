from typing import Dict, Any
from app.graph.state import AgentState
from app.services.trace_manager import trace_manager
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class FinalizerNode:
    """Finalizes task results and synthesizes executive deliverable"""
    
    async def finalize(self, state: AgentState) -> AgentState:
        task_id = state.get("task_id", "")
        logger.info(f"Finalizing task: {task_id}")
        
        agent_run_id = trace_manager.create_agent_run(
            task_id=task_id,
            agent_name="finalizer",
            parent_run_id=None,
            input_data={"goal": state.get("goal")}
        )
        
        step_order = len(trace_manager.get_trace_steps(task_id)) + 1
        trace_manager.create_trace_step(
            task_id=task_id,
            agent_run_id=agent_run_id,
            parent_run_id=None,
            step_type="action",
            content={"message": "Assembling all agent deliverables into final artifact", "agent": "finalizer"},
            order=step_order
        )
        
        try:
            final_result = {
                "goal": state.get("goal"),
                "subtasks": state.get("subtasks", []),
                "research_results": state.get("research_results", {}),
                "code_results": state.get("code_results", {}),
                "review": state.get("review_result", {}),
                "completed_at": datetime.now().isoformat()
            }
            
            state["result"] = final_result
            state["status"] = "completed"
            state["current_step"] = "finalized"
            
            trace_manager.update_agent_run(
                agent_run_id=agent_run_id,
                output=final_result,
                status="completed"
            )
            
            trace_manager.create_trace_step(
                task_id=task_id,
                agent_run_id=agent_run_id,
                parent_run_id=None,
                step_type="result",
                content={
                    "message": "Task completed successfully. All agent artifacts ready.",
                    "agent": "finalizer",
                    "summary": f"Completed {len(state.get('subtasks', []))} subtasks with passing review."
                },
                order=step_order + 1
            )
            
        except Exception as e:
            logger.error(f"Finalization error: {e}")
            if "errors" not in state:
                state["errors"] = []
            state["errors"].append(f"Finalization error: {e}")
            state["status"] = "failed"
            
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
                content={"message": f"Finalization error: {e}"},
                order=step_order + 1
            )
            
        state["updated_at"] = datetime.now()
        return state

finalizer_node = FinalizerNode()
