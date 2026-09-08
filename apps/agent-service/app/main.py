from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging
from datetime import datetime
from bson import ObjectId

from app.config.settings import settings
from app.db.mongo_client import MongoDB
from app.schemas.task import RunTaskRequest, RunTaskResponse, TaskStatusResponse
from app.graph.build_graph import multi_agent_graph
from app.graph.state import AgentState

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    await MongoDB.connect_async()
    logger.info("Agent Service started and connected to MongoDB")
    
    # Initialize and seed Qdrant knowledge base
    try:
        from app.rag.ingestion import seed_default_knowledge
        await seed_default_knowledge()
        logger.info("Qdrant RAG knowledge base verified and seeded")
    except Exception as e:
        logger.warning(f"RAG startup seeding note: {e}")

    yield
    await MongoDB.close_async()
    logger.info("Agent Service stopped")

app = FastAPI(
    title="AgentOps Multi-Agent Service",
    version="1.0.0",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://localhost:4000",
        "http://127.0.0.1:4000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "ok",
        "service": "agent-service",
        "timestamp": datetime.now().isoformat()
    }

async def execute_task_workflow(initial_state: AgentState):
    """Background task runner for LangGraph workflow"""
    try:
        logger.info(f"Starting LangGraph workflow for task {initial_state['task_id']}")
        await multi_agent_graph.ainvoke(initial_state)
        logger.info(f"Completed LangGraph workflow for task {initial_state['task_id']}")
    except Exception as e:
        logger.error(f"Error during graph execution for task {initial_state.get('task_id')}: {e}")

@app.post("/run-task", response_model=RunTaskResponse)
@app.post("/api/v1/run-task", response_model=RunTaskResponse)
async def run_task(request: RunTaskRequest, background_tasks: BackgroundTasks):
    """Trigger multi-agent task execution via LangGraph"""
    task_id = request.task_id
    goal = request.get_goal()
    logger.info(f"Received execution request for task: {task_id} with goal: {goal}")
    
    try:
        db = MongoDB.get_async_db()
        oid = ObjectId(task_id) if ObjectId.is_valid(task_id) else task_id
        
        # Mark task status in MongoDB
        await db.tasks.update_one(
            {"_id": oid},
            {
                "$set": {
                    "status": "running",
                    "startedAt": datetime.now(),
                    "started_at": datetime.now()
                }
            }
        )
        
        initial_state: AgentState = {
            "task_id": task_id,
            "goal": goal,
            "description": request.description,
            "status": "running",
            "current_step": "init",
            "errors": [],
            "result": None,
            "active_agent": "planner",
            "subtasks": [],
            "current_subtask_id": None,
            "trace_steps": [],
            "agent_runs": [],
            "trace_counter": 0,
            "research_results": {},
            "code_results": {},
            "review_result": None,
            "retry_count": 0,
            "max_retries": int(request.config.get("maxRetries", 2)) if isinstance(request.config, dict) else 2,
            "budget": request.budget or {},
            "cost": {"total": 0.0, "currency": "USD"},
            "started_at": datetime.now(),
            "updated_at": datetime.now()
        }
        
        # Run graph asynchronously in background
        background_tasks.add_task(execute_task_workflow, initial_state)
        
        return RunTaskResponse(
            task_id=task_id,
            status="running",
            message="Multi-agent execution queued and started",
            started_at=datetime.now()
        )
        
    except Exception as e:
        logger.error(f"Error starting task: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/task/{task_id}/status", response_model=TaskStatusResponse)
@app.get("/api/v1/task/{task_id}/status", response_model=TaskStatusResponse)
async def get_task_status(task_id: str):
    """Get status and result for task"""
    try:
        db = MongoDB.get_async_db()
        oid = ObjectId(task_id) if ObjectId.is_valid(task_id) else task_id
        task = await db.tasks.find_one({"_id": oid})
        
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        
        return TaskStatusResponse(
            task_id=task_id,
            status=task.get("status", "unknown"),
            result=task.get("result"),
            error=task.get("error")
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting task status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/task/{task_id}/pause")
async def pause_task(task_id: str):
    """Pause task execution"""
    try:
        db = MongoDB.get_async_db()
        oid = ObjectId(task_id) if ObjectId.is_valid(task_id) else task_id
        await db.tasks.update_one({"_id": oid}, {"$set": {"status": "waiting_approval"}})
        return {"task_id": task_id, "status": "waiting_approval", "message": "Task paused"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/task/{task_id}/resume")
async def resume_task(task_id: str, background_tasks: BackgroundTasks):
    """Resume task execution"""
    try:
        db = MongoDB.get_async_db()
        oid = ObjectId(task_id) if ObjectId.is_valid(task_id) else task_id
        task = await db.tasks.find_one({"_id": oid})
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
            
        await db.tasks.update_one({"_id": oid}, {"$set": {"status": "running"}})
        
        resumed_state: AgentState = {
            "task_id": task_id,
            "goal": task.get("goal", ""),
            "description": task.get("description"),
            "status": "running",
            "current_step": "resumed",
            "errors": [],
            "result": None,
            "active_agent": "planner",
            "subtasks": [],
            "current_subtask_id": None,
            "trace_steps": [],
            "agent_runs": [],
            "trace_counter": 0,
            "research_results": {},
            "code_results": {},
            "review_result": None,
            "retry_count": 0,
            "max_retries": 2,
            "budget": task.get("budget", {}),
            "cost": {"total": 0.0, "currency": "USD"},
            "started_at": datetime.now(),
            "updated_at": datetime.now()
        }
        background_tasks.add_task(execute_task_workflow, resumed_state)
        return {"task_id": task_id, "status": "running", "message": "Task resumed"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/task/{task_id}/cancel")
async def cancel_task(task_id: str):
    """Cancel task execution"""
    try:
        db = MongoDB.get_async_db()
        oid = ObjectId(task_id) if ObjectId.is_valid(task_id) else task_id
        now = datetime.now()
        await db.tasks.update_one(
            {"_id": oid},
            {"$set": {"status": "cancelled", "completedAt": now, "completed_at": now}}
        )
        return {"task_id": task_id, "status": "cancelled", "message": "Task cancelled"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/task/{task_id}/replay/{trace_id}")
async def replay_trace_step(task_id: str, trace_id: str):
    """Replay a specific historical trace step with benchmark comparison"""
    try:
        from app.services.replay_service import replay_service
        result = await replay_service.replay_step(task_id, trace_id)
        return {"success": True, "data": result}
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        logger.error(f"Error replaying trace step: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/rag/ingest")
async def rag_ingest_document(payload: dict):
    """Ingest document into Qdrant vector collection"""
    try:
        from app.rag.ingestion import ingest_document
        doc_id = payload.get("doc_id", "doc_" + str(datetime.now().timestamp()))
        title = payload.get("title", "Untitled")
        content = payload.get("content", "")
        metadata = payload.get("metadata", {})
        
        if not content:
            raise HTTPException(status_code=400, detail="Document content cannot be empty")
            
        chunks_count = await ingest_document(doc_id, title, content, metadata)
        return {
            "success": True,
            "doc_id": doc_id,
            "title": title,
            "chunks_ingested": chunks_count
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error ingesting document into RAG: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/rag/query")
async def rag_query_knowledge(payload: dict):
    """Query Qdrant vector collection for semantic matches"""
    try:
        from app.rag.retriever import retrieve_relevant_context
        query = payload.get("query", "")
        top_k = int(payload.get("top_k", 3))
        
        if not query:
            raise HTTPException(status_code=400, detail="Query string cannot be empty")
            
        hits = await retrieve_relevant_context(query, top_k=top_k)
        return {
            "success": True,
            "query": query,
            "count": len(hits),
            "hits": hits
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying RAG: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/rag/status")
async def rag_status():
    """Check Qdrant vector database status and collection stats"""
    import httpx
    import os
    qdrant_url = os.getenv("QDRANT_URL", "http://localhost:6333").rstrip("/")
    collection = os.getenv("QDRANT_COLLECTION", "agentops_knowledge")
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{qdrant_url}/collections/{collection}")
            if resp.status_code == 200:
                data = resp.json().get("result", {})
                return {
                    "status": "connected",
                    "collection": collection,
                    "points_count": data.get("points_count", 0),
                    "vectors_count": data.get("vectors_count", 0),
                    "indexed_vectors_count": data.get("indexed_vectors_count", 0)
                }
            return {"status": "collection_not_found", "code": resp.status_code}
    except Exception as e:
        return {"status": "disconnected", "error": str(e)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.agent_host,
        port=settings.agent_port,
        reload=True
    )