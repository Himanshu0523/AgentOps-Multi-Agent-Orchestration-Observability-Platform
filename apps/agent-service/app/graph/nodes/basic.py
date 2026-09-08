from typing import Dict, Any
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from app.config.settings import settings
from app.graph.state import AgentState
import logging

logger = logging.getLogger(__name__)

class BasicNodes:
    def __init__(self):
        self.llm = ChatOpenAI(
            model=settings.openai_model,
            temperature=settings.temperature if hasattr(settings, 'temperature') else 0.7,
            api_key=settings.openai_api_key
        )
    
    async def process_task(self, state: AgentState) -> AgentState:
        """Process a basic task"""
        logger.info(f"Processing task: {state['task_id']}")
        
        try:
            prompt = ChatPromptTemplate.from_messages([
                ("system", "You are an AI agent tasked with completing a goal. Provide a comprehensive response."),
                ("user", "Goal: {goal}\nDescription: {description}")
            ])
            
            chain = prompt | self.llm
            
            result = await chain.ainvoke({
                "goal": state["goal"],
                "description": state.get("description", "")
            })
            
            state["results"] = {
                "output": result.content,
                "model": settings.openai_model,
                "timestamp": datetime.now().isoformat()
            }
            state["status"] = "completed"
            state["current_step"] = "completed"
            
        except Exception as e:
            logger.error(f"Error processing task: {e}")
            state["errors"].append(str(e))
            state["status"] = "failed"
            state["current_step"] = "error"
        
        state["updated_at"] = datetime.now()
        return state
    
    async def save_to_mongodb(self, state: AgentState) -> AgentState:
        """Save results to MongoDB"""
        logger.info(f"Saving results for task: {state['task_id']}")
        
        try:
            from app.db.mongodb import sync_db
            
            # Update task
            sync_db.tasks.update_one(
                {"_id": state["task_id"]},
                {
                    "$set": {
                        "status": state["status"],
                        "result": state.get("results", {}),
                        "completed_at": datetime.now(),
                        "duration": (datetime.now() - state["started_at"]).total_seconds()
                    }
                }
            )
            
            # Create agent run record
            agent_run = {
                "task_id": state["task_id"],
                "agent_name": "basic_agent",
                "input": {
                    "goal": state["goal"],
                    "description": state.get("description", "")
                },
                "output": state.get("results", {}),
                "status": state["status"],
                "started_at": state["started_at"],
                "completed_at": datetime.now(),
                "duration": (datetime.now() - state["started_at"]).total_seconds(),
                "cost": {
                    "amount": 0.0,
                    "currency": "USD"
                }
            }
            
            sync_db.agent_runs.insert_one(agent_run)
            
        except Exception as e:
            logger.error(f"Error saving to MongoDB: {e}")
            state["errors"].append(f"DB Error: {e}")
        
        return state

basic_nodes = BasicNodes()