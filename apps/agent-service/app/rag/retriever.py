import os
import logging
import httpx
from typing import List, Dict, Any
from app.rag.embeddings import get_embedding

logger = logging.getLogger(__name__)

QDRANT_URL = os.getenv("QDRANT_URL", "http://localhost:6333").rstrip("/")
COLLECTION_NAME = os.getenv("QDRANT_COLLECTION", "agentops_knowledge")

async def search_qdrant(
    query: str,
    top_k: int = 3,
    score_threshold: float = 0.0
) -> List[Dict[str, Any]]:
    """
    Search Qdrant collection for chunks most semantically similar to query vector.
    """
    if not query or not query.strip():
        return []

    query_vector = get_embedding(query)

    search_payload = {
        "vector": query_vector,
        "limit": top_k,
        "with_payload": True
    }

    if score_threshold > 0.0:
        search_payload["score_threshold"] = score_threshold

    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.post(
                f"{QDRANT_URL}/collections/{COLLECTION_NAME}/points/search",
                json=search_payload
            )
            if resp.status_code != 200:
                logger.warning(f"Qdrant search returned {resp.status_code}: {resp.text}")
                return []

            data = resp.json()
            hits = data.get("result", [])

            results: List[Dict[str, Any]] = []
            for hit in hits:
                payload = hit.get("payload", {})
                results.append({
                    "id": hit.get("id"),
                    "score": round(float(hit.get("score", 0.0)), 4),
                    "doc_id": payload.get("doc_id"),
                    "title": payload.get("title", "Untitled Document"),
                    "content": payload.get("content", ""),
                    "chunk_index": payload.get("chunk_index", 0),
                    "metadata": payload.get("metadata", {})
                })

            return results
        except Exception as e:
            logger.error(f"Error executing Qdrant search: {e}")
            return []

async def retrieve_relevant_context(query: str, top_k: int = 3) -> List[Dict[str, Any]]:
    """Convenience alias for search_qdrant"""
    return await search_qdrant(query, top_k=top_k)
