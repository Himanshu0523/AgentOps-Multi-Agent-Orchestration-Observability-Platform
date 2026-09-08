from typing import Dict, Any
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from app.config.settings import settings
from app.graph.state import AgentState
from app.services.trace_manager import trace_manager
from app.services.risk_detector import evaluate_risk
from app.services.docker_sandbox import docker_sandbox
from app.db.mongo_client import sync_db
from bson import ObjectId
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class CoderNode:
    """Coder agent - generates clean, modular code with execution tracing"""
    
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
    
    async def code(self, state: AgentState) -> AgentState:
        """Execute coding subtask"""
        task_id = state.get("task_id", "")
        current_id = state.get("current_subtask_id")
        logger.info(f"Coder executing for task {task_id}, subtask {current_id}")
        
        subtasks = state.get("subtasks", [])
        current_subtask = next((s for s in subtasks if s["id"] == current_id), None)
        
        if not current_subtask:
            if "errors" not in state:
                state["errors"] = []
            state["errors"].append("No current coding subtask found")
            return state
        
        # Create agent run for coder
        agent_run_id = trace_manager.create_agent_run(
            task_id=task_id,
            agent_name="coder",
            parent_run_id=None,
            input_data={"task": current_subtask.get("description", "")}
        )
        current_subtask["agent_run_id"] = agent_run_id
        current_subtask["status"] = "running"
        
        step_order = len(trace_manager.get_trace_steps(task_id)) + 1
        
        # Check risk level
        risk_level, requires_approval, risk_reason = evaluate_risk(
            action=current_subtask.get("description", ""),
            details={"goal": state.get("goal", ""), "subtask": current_subtask}
        )

        # Check if already approved by human in the loop
        if requires_approval:
            t_oid = ObjectId(task_id) if ObjectId.is_valid(task_id) else task_id
            prior_approval = sync_db.approvals.find_one({
                "$or": [{"taskId": t_oid}, {"task_id": t_oid}],
                "status": "approved"
            })
            if prior_approval:
                requires_approval = False
                logger.info(f"Prior human authorization found ({prior_approval.get('_id')}). Resuming execution.")

        if requires_approval:
            logger.warning(f"High risk operation detected ({risk_level}): {risk_reason}. Requesting human approval.")
            approval_id = trace_manager.create_approval(
                task_id=task_id,
                agent_run_id=agent_run_id,
                approval_type="code_execution",
                risk_level=risk_level,
                action=f"Execute code for: {current_subtask.get('description')}",
                details={
                    "reason": risk_reason,
                    "risk_level": risk_level,
                    "subtask_id": current_id,
                    "subtask_description": current_subtask.get("description")
                },
                requested_by="coder"
            )

            # Record waiting_approval trace step
            trace_manager.create_trace_step(
                task_id=task_id,
                agent_run_id=agent_run_id,
                parent_run_id=None,
                step_type="observation",
                content={
                    "message": f"Paused for Human Approval ({risk_level.upper()} RISK): {risk_reason}",
                    "approval_id": approval_id,
                    "risk_level": risk_level,
                    "action": current_subtask.get("description"),
                    "agent": "coder"
                },
                order=step_order + 1
            )

            current_subtask["status"] = "waiting_approval"
            trace_manager.update_agent_run(
                agent_run_id=agent_run_id,
                status="pending",
                output={"waiting_approval": True, "approval_id": approval_id, "risk_reason": risk_reason}
            )

            state["status"] = "waiting_approval"
            state["current_step"] = "waiting_approval"
            state["current_subtask_id"] = None
            state["updated_at"] = datetime.now()
            return state

        
        try:
            code_output = ""
            if self.llm:
                prompt = ChatPromptTemplate.from_messages([
                    ("system", "You are an expert coding agent. Provide a complete, production-ready, documented solution."),
                    ("user", "Task: {task}\nGoal: {goal}")
                ])
                chain = prompt | self.llm
                res = await chain.ainvoke({
                    "task": current_subtask.get("description"),
                    "goal": state.get("goal", "")
                })
                code_output = res.content
            else:
                code_output = (
                    "```typescript\n"
                    "// Production-grade solution generated by AgentOps Coder\n"
                    "export interface TaskExecutionEngine {\n"
                    "  taskId: string;\n"
                    "  execute(): Promise<{ success: boolean; data: unknown }>;\n"
                    "}\n\n"
                    "export class AgentTaskRunner implements TaskExecutionEngine {\n"
                    "  constructor(public readonly taskId: string) {}\n\n"
                    "  async execute() {\n"
                    "    console.log(`Executing autonomous workflow for ${this.taskId}`);\n"
                    "    return { success: true, timestamp: new Date().toISOString() };\n"
                    "  }\n"
                    "}\n"
                    "```"
                )
            
            # Phase 10: Secure Code Sandbox Execution
            sandbox_step_order = len(trace_manager.get_trace_steps(task_id)) + 1
            trace_manager.create_trace_step(
                task_id=task_id,
                agent_run_id=agent_run_id,
                parent_run_id=None,
                step_type="tool_call",
                content={
                    "message": "Executing code in secure air-gapped sandbox",
                    "tool": "docker_sandbox",
                    "limits": {"memory": "256m", "cpus": "0.5", "network": "none", "timeout": "10s"}
                },
                order=sandbox_step_order
            )

            sandbox_result = await docker_sandbox.execute_code(code_output)
            
            trace_manager.create_trace_step(
                task_id=task_id,
                agent_run_id=agent_run_id,
                parent_run_id=None,
                step_type="result",
                content={
                    "message": f"Sandbox execution completed (exit_code: {sandbox_result.get('exit_code')}, duration: {sandbox_result.get('duration_ms')}ms)",
                    "sandbox": sandbox_result,
                    "agent": "coder"
                },
                order=sandbox_step_order + 1
            )

            subtask_result = {
                "code": code_output,
                "sandbox": sandbox_result,
                "timestamp": datetime.now().isoformat()
            }
            
            current_subtask["status"] = "completed"
            current_subtask["result"] = subtask_result
            
            if "code_results" not in state:
                state["code_results"] = {}
            state["code_results"][current_subtask["id"]] = subtask_result
            
            # Update agent run
            trace_manager.update_agent_run(
                agent_run_id=agent_run_id,
                output=subtask_result,
                status="completed"
            )
            
            # Record result trace
            trace_manager.create_trace_step(
                task_id=task_id,
                agent_run_id=agent_run_id,
                parent_run_id=None,
                step_type="result",
                content={
                    "message": "Code generation completed",
                    "code_preview": code_output[:200] + "..." if len(code_output) > 200 else code_output,
                    "agent": "coder"
                },
                order=step_order + 1
            )
            
            state["current_step"] = "code_complete"
            state["active_agent"] = "coder"

            # Advance to next pending subtask
            completed_ids = [s["id"] for s in subtasks if s.get("status") == "completed"]
            next_subtask = next((s for s in subtasks if s.get("status") != "completed" and all(d in completed_ids for d in s.get("dependencies", []))), None)
            state["current_subtask_id"] = next_subtask["id"] if next_subtask else None
            
        except Exception as e:
            logger.error(f"Code generation error: {e}")
            current_subtask["status"] = "failed"
            state["current_subtask_id"] = None
            if "errors" not in state:
                state["errors"] = []
            state["errors"].append(f"Code generation error: {e}")
            
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
                content={"message": f"Code generation error: {e}"},
                order=step_order + 1
            )
            state["current_step"] = "code_error"
        
        state["updated_at"] = datetime.now()
        return state

coder_node = CoderNode()
