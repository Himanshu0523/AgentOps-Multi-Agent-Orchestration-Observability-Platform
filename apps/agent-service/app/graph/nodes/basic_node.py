from typing import Dict, Any
from app.graph.state import AgentState
from app.db.mongo_client import sync_db
from bson import ObjectId
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class BasicNode:
    """Basic node for saving state and simple fallback execution"""
    
    async def save_to_db(self, state: AgentState) -> AgentState:
        """Persist final task status, result, and timing to MongoDB"""
        task_id = state.get("task_id")
        logger.info(f"Saving final state to MongoDB for task: {task_id}")
        
        try:
            started = state.get("started_at", datetime.now())
            now = datetime.now()
            duration_ms = (now - started).total_seconds() * 1000
            
            oid = ObjectId(task_id) if ObjectId.is_valid(task_id) else task_id
            
            task_status = state.get("status", "completed")
            update_fields = {
                "status": task_status,
                "result": state.get("result"),
                "duration": duration_ms,
                "updatedAt": now
            }
            if task_status != "waiting_approval":
                update_fields["completedAt"] = now
                update_fields["completed_at"] = now

            
            if state.get("errors"):
                update_fields["error"] = {
                    "message": "; ".join(state["errors"]),
                    "timestamp": now
                }
            
            sync_db.tasks.update_one(
                {"_id": oid},
                {"$set": update_fields}
            )
            logger.info(f"Task {task_id} successfully updated in MongoDB with status '{update_fields['status']}'")
            
        except Exception as e:
            logger.error(f"Error saving task to MongoDB: {e}")
            if "errors" not in state:
                state["errors"] = []
            state["errors"].append(f"DB Save Error: {e}")
            
        return state

basic_node = BasicNode()
