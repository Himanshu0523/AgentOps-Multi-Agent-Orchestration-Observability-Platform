from langgraph.graph import StateGraph, END
from app.graph.state import AgentState
from app.graph.nodes.planner import planner_node
from app.graph.nodes.researcher import researcher_node
from app.graph.nodes.coder import coder_node
from app.graph.nodes.reviewer import reviewer_node
from app.graph.nodes.finalizer import finalizer_node
from app.graph.nodes.basic_node import basic_node

def build_multi_agent_graph():
    """Build the multi-agent orchestration graph with full cycle tracking"""
    workflow = StateGraph(AgentState)
    
    # Add all agent nodes
    workflow.add_node("planner", planner_node.plan)
    workflow.add_node("researcher", researcher_node.research)
    workflow.add_node("coder", coder_node.code)
    workflow.add_node("reviewer", reviewer_node.review)
    workflow.add_node("finalizer", finalizer_node.finalize)
    workflow.add_node("save", basic_node.save_to_db)
    
    # Entry point is the Planner
    workflow.set_entry_point("planner")
    
    # Planner routes dynamically based on pending subtask dependencies
    workflow.add_conditional_edges(
        "planner",
        planner_node.route_next,
        {
            "research": "researcher",
            "coding": "coder",
            "reviewer": "reviewer",
            "waiting_approval": "save"
        }
    )
    
    # Researcher routes to next subtask via planner router
    workflow.add_conditional_edges(
        "researcher",
        planner_node.route_next,
        {
            "research": "researcher",
            "coding": "coder",
            "reviewer": "reviewer",
            "waiting_approval": "save"
        }
    )
    
    # Coder routes to next subtask via planner router
    workflow.add_conditional_edges(
        "coder",
        planner_node.route_next,
        {
            "research": "researcher",
            "coding": "coder",
            "reviewer": "reviewer",
            "waiting_approval": "save"
        }
    )
    
    # Reviewer decides retry loop or finalize
    workflow.add_conditional_edges(
        "reviewer",
        reviewer_node.should_retry,
        {
            "planner": "planner",
            "finalize": "finalizer"
        }
    )
    
    # Finalize -> Save -> END
    workflow.add_edge("finalizer", "save")
    workflow.add_edge("save", END)
    
    return workflow.compile()

# Compile both symbols for backwards compatibility
multi_agent_graph = build_multi_agent_graph()
basic_graph = multi_agent_graph