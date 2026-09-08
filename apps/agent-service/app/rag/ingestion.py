import os
import uuid
import logging
import httpx
from typing import Dict, Any, Optional
from app.rag.chunking import chunk_text
from app.rag.embeddings import get_embedding, EMBEDDING_DIM

logger = logging.getLogger(__name__)

QDRANT_URL = os.getenv("QDRANT_URL", "http://localhost:6333").rstrip("/")
COLLECTION_NAME = os.getenv("QDRANT_COLLECTION", "agentops_knowledge")

async def ensure_collection_exists() -> bool:
    """Check if Qdrant collection exists; if not, create with Cosine distance and 384 dims"""
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.get(f"{QDRANT_URL}/collections/{COLLECTION_NAME}")
            if resp.status_code == 200:
                return True

            # Collection not found, create it
            create_payload = {
                "vectors": {
                    "size": EMBEDDING_DIM,
                    "distance": "Cosine"
                }
            }
            create_resp = await client.put(
                f"{QDRANT_URL}/collections/{COLLECTION_NAME}",
                json=create_payload
            )
            if create_resp.status_code in [200, 201]:
                logger.info(f"Created Qdrant collection '{COLLECTION_NAME}' successfully")
                return True
            else:
                logger.error(f"Failed to create Qdrant collection: {create_resp.text}")
                return False
        except Exception as e:
            logger.warning(f"Could not connect to Qdrant at {QDRANT_URL}: {e}")
            return False

async def ingest_document(
    doc_id: str,
    title: str,
    content: str,
    metadata: Optional[Dict[str, Any]] = None
) -> int:
    """
    Split text into chunks, generate dense embeddings, and index into Qdrant collection.
    Returns number of indexed chunks.
    """
    await ensure_collection_exists()

    chunks = chunk_text(content, chunk_size=450, overlap=60)
    if not chunks:
        return 0

    points = []
    for c in chunks:
        chunk_content = c["content"]
        vector = get_embedding(chunk_content)
        point_id = str(uuid.uuid4())

        points.append({
            "id": point_id,
            "vector": vector,
            "payload": {
                "doc_id": doc_id,
                "title": title,
                "content": chunk_content,
                "chunk_index": c["index"],
                "metadata": metadata or {}
            }
        })

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            resp = await client.put(
                f"{QDRANT_URL}/collections/{COLLECTION_NAME}/points?wait=true",
                json={"points": points}
            )
            if resp.status_code in [200, 201]:
                logger.info(f"Ingested {len(points)} chunks for document '{title}' ({doc_id})")
                return len(points)
            else:
                logger.error(f"Qdrant point insertion error: {resp.text}")
                return 0
        except Exception as e:
            logger.error(f"Error communicating with Qdrant: {e}")
            return 0

async def seed_default_knowledge():
    """Seed foundational knowledge base if collection is empty"""
    try:
        await ensure_collection_exists()
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{QDRANT_URL}/collections/{COLLECTION_NAME}")
            if resp.status_code == 200:
                data = resp.json()
                point_count = data.get("result", {}).get("points_count", 0)
                if point_count and point_count > 0:
                    return

        # 1. Architecture Guide
        await ingest_document(
            doc_id="arch-001",
            title="AgentOps Multi-Agent Architecture",
            content="""
            The AgentOps platform features a multi-agent orchestration architecture:
            1. Planner: Analyzes the user's high-level goal, breaks it down into executable subtasks,
               and formulates structured execution graphs.
            2. Researcher: Gathers external and internal documentation, summarizes relevant requirements,
               and prepares domain knowledge.
            3. Coder: Synthesizes modular, production-ready code solutions and executes them inside
               the isolated, air-gapped Docker sandbox container.
            4. Reviewer: Evaluates code against a rigorous rubric covering functionality, security,
               edge cases, and style. Triggers automated self-correction loops when score is below threshold.
            5. Finalizer: Aggregates artifacts, packages outputs, and writes the terminal execution report.
            """,
            metadata={"category": "architecture", "version": "2.0"}
        )

        # 2. Security & Sandbox Guide
        await ingest_document(
            doc_id="sec-002",
            title="Secure Code Sandbox and Safety Policies",
            content="""
            AgentOps enforces zero-trust execution policies for all generated scripts:
            - Docker air-gapped sandboxes run without network access (--network none).
            - Memory is strictly limited to 256MB and CPU quota is capped at 0.5 cores.
            - The container root filesystem is mounted read-only with a temporary 32MB tmpfs scratch space.
            - All Linux capabilities are dropped (--cap-drop ALL) and execution runs as unprivileged user 1000:1000.
            - Human-in-the-loop approval is mandatory for medium, high, and critical risk operations before execution.
            """,
            metadata={"category": "security", "version": "2.0"}
        )

        # 3. Budgeting & Pricing Guide
        await ingest_document(
            doc_id="fin-003",
            title="Budget Enforcement and Pricing Engine",
            content="""
            Every agent task tracks token usage and financial cost in real-time:
            - GPT-4o pricing: $2.50 per 1M input tokens, $10.00 per 1M output tokens.
            - GPT-4 pricing: $30.00 per 1M input tokens, $60.00 per 1M output tokens.
            - GPT-3.5-Turbo: $0.50 per 1M input tokens, $1.50 per 1M output tokens.
            - Tasks specify a maxCost ceiling (default $1.00). If cumulative expenditure exceeds maxCost,
              the pricing engine immediately sets task status to budget_exceeded and halts execution.
            """,
            metadata={"category": "finance", "version": "2.0"}
        )

        logger.info("Successfully seeded default knowledge base into Qdrant")
    except Exception as e:
        logger.warning(f"Failed to seed default knowledge: {e}")
