from typing import Dict, Any, Optional, List
from datetime import datetime
from bson import ObjectId
from app.db.mongo_client import sync_db
import logging

logger = logging.getLogger(__name__)

class TraceManager:
    """Manages trace steps and agent runs in MongoDB with dual collection & field support"""
    
    def __init__(self):
        self.trace_counter = 0
        self.agent_run_counter = 0
    
    def create_agent_run(
        self,
        task_id: str,
        agent_name: str,
        parent_run_id: Optional[str] = None,
        input_data: Optional[Dict[str, Any]] = None
    ) -> str:
        """Create an agent run and return its ID"""
        try:
            self.agent_run_counter += 1
            now = datetime.now()
            t_oid = ObjectId(task_id) if ObjectId.is_valid(task_id) else task_id
            p_oid = ObjectId(parent_run_id) if parent_run_id and ObjectId.is_valid(parent_run_id) else None
            
            agent_run = {
                # CamelCase (Mongoose model schema)
                "taskId": t_oid,
                "agentName": agent_name,
                "parentRunId": p_oid,
                "input": input_data,
                "output": None,
                "status": "running",
                "cost": {
                    "tokens": {"input": 0, "output": 0, "total": 0},
                    "amount": 0.0,
                    "currency": "USD"
                },
                "startedAt": now,
                "completedAt": None,
                "duration": None,
                "error": None,
                "createdAt": now,
                "updatedAt": now,
                
                # snake_case (Agent Service / SocketGateway schema)
                "task_id": t_oid,
                "agent_name": agent_name,
                "parent_run_id": p_oid,
                "started_at": now,
                "created_at": now
            }
            
            result = sync_db.agentruns.insert_one(agent_run)
            inserted_id = str(result.inserted_id)
            
            # Dual write to agent_runs for raw queries
            try:
                sync_db.agent_runs.replace_one({"_id": result.inserted_id}, agent_run, upsert=True)
            except Exception:
                pass
                
            return inserted_id
            
        except Exception as e:
            logger.error(f"Error creating agent run: {e}")
            return None
    
    def update_agent_run(
        self,
        agent_run_id: str,
        output: Optional[Dict[str, Any]] = None,
        status: str = "completed",
        error: Optional[str] = None,
        cost: Optional[Dict[str, Any]] = None
    ) -> None:
        """Update an agent run with results"""
        try:
            now = datetime.now()
            oid = ObjectId(agent_run_id) if ObjectId.is_valid(agent_run_id) else agent_run_id
            
            update_data = {
                "status": status,
                "completedAt": now,
                "completed_at": now,
                "updatedAt": now
            }
            
            if output is not None:
                update_data["output"] = output
            
            if error:
                update_data["error"] = {"message": error}
            
            if cost:
                update_data["cost"] = cost
            
            # Calculate duration
            agent_run = sync_db.agentruns.find_one({"_id": oid})
            if agent_run:
                started = agent_run.get("startedAt") or agent_run.get("started_at")
                if started:
                    duration_ms = (now - started).total_seconds() * 1000
                    update_data["duration"] = duration_ms
            
            sync_db.agentruns.update_one({"_id": oid}, {"$set": update_data})
            try:
                sync_db.agent_runs.update_one({"_id": oid}, {"$set": update_data})
            except Exception:
                pass
            
        except Exception as e:
            logger.error(f"Error updating agent run: {e}")
    
    def create_trace_step(
        self,
        task_id: str,
        agent_run_id: Optional[str],
        parent_run_id: Optional[str],
        step_type: str,
        content: Dict[str, Any],
        order: Optional[int] = None,
        cost: Optional[Dict[str, Any]] = None
    ) -> str:
        """Create a trace step and return its ID"""
        try:
            self.trace_counter += 1
            now = datetime.now()
            
            if order is None:
                order = self.trace_counter
            
            t_oid = ObjectId(task_id) if ObjectId.is_valid(task_id) else task_id
            a_oid = ObjectId(agent_run_id) if agent_run_id and ObjectId.is_valid(agent_run_id) else None
            p_oid = ObjectId(parent_run_id) if parent_run_id and ObjectId.is_valid(parent_run_id) else None
            
            trace_step = {
                # Mongoose schema
                "taskId": t_oid,
                "agentRunId": a_oid,
                "parentRunId": p_oid,
                "stepType": step_type,
                "content": content,
                "cost": cost,
                "order": order,
                "createdAt": now,
                "updatedAt": now,
                
                # snake_case schema for Change Streams / raw listeners
                "task_id": t_oid,
                "agent_run_id": a_oid,
                "parent_run_id": p_oid,
                "step_type": step_type,
                "created_at": now
            }
            
            result = sync_db.tracesteps.insert_one(trace_step)
            inserted_id = str(result.inserted_id)
            
            # Dual write to trace_steps for socket gateway change streams
            try:
                sync_db.trace_steps.replace_one({"_id": result.inserted_id}, trace_step, upsert=True)
            except Exception:
                pass
                
            return inserted_id
            
        except Exception as e:
            logger.error(f"Error creating trace step: {e}")
            return None
    
    def get_trace_steps(self, task_id: str) -> List[Dict[str, Any]]:
        """Get all trace steps for a task"""
        try:
            t_oid = ObjectId(task_id) if ObjectId.is_valid(task_id) else task_id
            return list(sync_db.tracesteps.find({"$or": [{"taskId": t_oid}, {"task_id": t_oid}]}).sort("order", 1))
        except Exception as e:
            logger.error(f"Error getting trace steps: {e}")
            return []
    
    def get_agent_runs(self, task_id: str) -> List[Dict[str, Any]]:
        """Get all agent runs for a task"""
        try:
            t_oid = ObjectId(task_id) if ObjectId.is_valid(task_id) else task_id
            return list(sync_db.agentruns.find({"$or": [{"taskId": t_oid}, {"task_id": t_oid}]}).sort("createdAt", 1))
        except Exception as e:
            logger.error(f"Error getting agent runs: {e}")
            return []

    def create_approval(
        self,
        task_id: str,
        agent_run_id: str,
        approval_type: str,
        risk_level: str,
        action: str,
        details: Optional[Dict[str, Any]] = None,
        requested_by: str = "coder"
    ) -> str:
        """Create a pending human approval in MongoDB and set task status to waiting_approval"""
        try:
            now = datetime.now()
            t_oid = ObjectId(task_id) if ObjectId.is_valid(task_id) else task_id
            a_oid = ObjectId(agent_run_id) if agent_run_id and ObjectId.is_valid(agent_run_id) else None
            
            approval_doc = {
                "taskId": t_oid,
                "agentRunId": a_oid,
                "type": approval_type,
                "riskLevel": risk_level,
                "action": action,
                "details": details or {},
                "status": "pending",
                "requestedBy": requested_by,
                "decidedBy": None,
                "decidedAt": None,
                "reason": None,
                "expiresAt": None,
                "createdAt": now,
                "updatedAt": now,
                "task_id": t_oid,
                "agent_run_id": a_oid,
                "risk_level": risk_level,
                "requested_by": requested_by
            }
            
            result = sync_db.approvals.insert_one(approval_doc)
            inserted_id = str(result.inserted_id)
            
            # Update task status to 'waiting_approval'
            sync_db.tasks.update_one(
                {"_id": t_oid},
                {"$set": {"status": "waiting_approval", "updatedAt": now}}
            )
            
            return inserted_id
        except Exception as e:
            logger.error(f"Error creating approval: {e}")
            return None

trace_manager = TraceManager()

