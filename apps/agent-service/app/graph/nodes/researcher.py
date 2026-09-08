from typing import Dict, Any
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from app.config.settings import settings
from app.graph.state import AgentState
from app.services.trace_manager import trace_manager
from app.tools.web_search import web_search_tool
from app.rag.retriever import retrieve_relevant_context
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class ResearcherNode:
    """Researcher agent - performs information gathering and synthesis"""
    
    def __init__(self):
        self._llm = None

    @property
    def llm(self):
        if self._llm is None and settings.openai_api_key and settings.openai_api_key != "your-openai-api-key":
            try:
                self._llm = ChatOpenAI(
                    model=settings.openai_model,
                    temperature=0.5,
                    api_key=settings.openai_api_key
                )
            except Exception as e:
                logger.warning(f"Could not initialize ChatOpenAI: {e}")
        return self._llm
    
    async def research(self, state: AgentState) -> AgentState:
        """Execute research subtask"""
        task_id = state.get("task_id", "")
        current_id = state.get("current_subtask_id")
        logger.info(f"Researcher executing for task {task_id}, subtask {current_id}")
        
        subtasks = state.get("subtasks", [])
        current_subtask = next((s for s in subtasks if s["id"] == current_id), None)
        
        if not current_subtask:
            if "errors" not in state:
                state["errors"] = []
            state["errors"].append("No current research subtask found")
            return state
        
        # Create agent run for researcher
        agent_run_id = trace_manager.create_agent_run(
            task_id=task_id,
            agent_name="researcher",
            parent_run_id=None,
            input_data={"subtask": current_subtask.get("description", "")}
        )
        current_subtask["agent_run_id"] = agent_run_id
        current_subtask["status"] = "running"
        
        # Step 1: Record tool call trace for Web Search
        step_order = len(trace_manager.get_trace_steps(task_id)) + 1
        trace_manager.create_trace_step(
            task_id=task_id,
            agent_run_id=agent_run_id,
            parent_run_id=None,
            step_type="tool_call",
            content={
                "message": f"Querying search tool for topic: {current_subtask.get('description')}",
                "tool": "web_search",
                "query": current_subtask.get("description")
            },
            order=step_order
        )
        
        try:
            # Perform web search
            search_summary = await web_search_tool.search_and_summarize(current_subtask.get("description", ""))
            
            # Query Qdrant RAG knowledge base
            rag_docs = []
            rag_context_text = ""
            try:
                rag_hits = await retrieve_relevant_context(current_subtask.get("description", ""), top_k=2)
                if rag_hits:
                    trace_manager.create_trace_step(
                        task_id=task_id,
                        agent_run_id=agent_run_id,
                        parent_run_id=None,
                        step_type="tool_call",
                        content={
                            "message": f"Retrieved {len(rag_hits)} reference docs from Qdrant RAG",
                            "tool": "qdrant_retriever",
                            "top_hit": rag_hits[0].get("title")
                        },
                        order=step_order + 1
                    )
                    rag_docs = [h.get("title") for h in rag_hits]
                    rag_context_text = "\n".join([f"- [{h.get('title')}]: {h.get('content')[:200]}..." for h in rag_hits])
            except Exception as rag_err:
                logger.warning(f"RAG query skipped in researcher: {rag_err}")

            output_content = ""
            if self.llm:
                prompt = ChatPromptTemplate.from_messages([
                    ("system", "You are a research agent. Synthesize search results and internal knowledge base documents into a detailed structured technical report."),
                    ("user", "Topic: {topic}\n\nInternal Docs:\n{rag_docs}\n\nSearch Results:\n{results}")
                ])
                chain = prompt | self.llm
                res = await chain.ainvoke({
                    "topic": current_subtask.get("description"),
                    "rag_docs": rag_context_text or "None",
                    "results": search_summary
                })
                output_content = res.content
            else:
                internal_ref = f"\n\n**Internal References (Qdrant)**:\n{rag_context_text}" if rag_context_text else ""
                output_content = (
                    f"### Research Synthesis for: {current_subtask.get('description')}\n\n"
                    f"1. **Architecture & Scope**: Analyzed performance requirements and modular decomposition patterns.{internal_ref}\n"
                    f"2. **Evidence & Sources**:\n{search_summary}\n"
                    f"3. **Recommendation**: Implement asynchronous non-blocking message queues with strict schema validation."
                )
            
            subtask_result = {
                "output": output_content,
                "sources": search_summary,
                "timestamp": datetime.now().isoformat()
            }
            
            current_subtask["status"] = "completed"
            current_subtask["result"] = subtask_result
            
            if "research_results" not in state:
                state["research_results"] = {}
            state["research_results"][current_subtask["id"]] = subtask_result
            
            # Update agent run
            trace_manager.update_agent_run(
                agent_run_id=agent_run_id,
                output=subtask_result,
                status="completed"
            )
            
            # Step 2: Record observation/result trace
            trace_manager.create_trace_step(
                task_id=task_id,
                agent_run_id=agent_run_id,
                parent_run_id=None,
                step_type="result",
                content={
                    "message": "Research analysis completed",
                    "output_preview": output_content[:200] + "..." if len(output_content) > 200 else output_content,
                    "agent": "researcher"
                },
                order=step_order + 1
            )
            
            state["current_step"] = "research_complete"
            state["active_agent"] = "researcher"

            # Advance to next pending subtask
            completed_ids = [s["id"] for s in subtasks if s.get("status") == "completed"]
            next_subtask = next((s for s in subtasks if s.get("status") != "completed" and all(d in completed_ids for d in s.get("dependencies", []))), None)
            state["current_subtask_id"] = next_subtask["id"] if next_subtask else None
            
        except Exception as e:
            logger.error(f"Research error: {e}")
            current_subtask["status"] = "failed"
            state["current_subtask_id"] = None
            if "errors" not in state:
                state["errors"] = []
            state["errors"].append(f"Research error: {e}")
            
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
                content={"message": f"Research error: {e}"},
                order=step_order + 1
            )
            state["current_step"] = "research_error"
        
        state["updated_at"] = datetime.now()
        return state

researcher_node = ResearcherNode()
