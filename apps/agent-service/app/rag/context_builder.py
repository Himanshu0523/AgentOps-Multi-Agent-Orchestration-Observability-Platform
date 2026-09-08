import logging
from typing import List, Dict, Any
from app.rag.retriever import retrieve_relevant_context

logger = logging.getLogger(__name__)

async def build_rag_context(
    query: str,
    top_k: int = 3,
    min_score: float = 0.15
) -> str:
    """
    Search Qdrant knowledge base and compile retrieved chunks into a prompt-ready context block.
    """
    try:
        hits = await retrieve_relevant_context(query, top_k=top_k)
        relevant_hits = [h for h in hits if h.get("score", 0.0) >= min_score]

        if not relevant_hits:
            return ""

        context_blocks = ["### RELEVANT KNOWLEDGE BASE CONTEXT (RAG):"]
        for i, hit in enumerate(relevant_hits, 1):
            title = hit.get("title", "Reference")
            score = hit.get("score", 0.0)
            content = hit.get("content", "").strip()
            context_blocks.append(f"[{i}] {title} (Relevance Score: {score:.2f})\n{content}")

        context_blocks.append("--- END KNOWLEDGE BASE CONTEXT ---")
        return "\n\n".join(context_blocks)
    except Exception as e:
        logger.warning(f"Error building RAG context for query '{query}': {e}")
        return ""

def format_citations(hits: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Format hit list into clean citation metadata for API responses and trace steps"""
    return [
        {
            "id": h.get("id"),
            "title": h.get("title"),
            "doc_id": h.get("doc_id"),
            "score": h.get("score"),
            "chunk_index": h.get("chunk_index")
        }
        for h in hits
    ]
