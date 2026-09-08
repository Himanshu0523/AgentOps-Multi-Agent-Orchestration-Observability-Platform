import re
import uuid
from typing import List, Dict, Any

def chunk_text(
    text: str,
    chunk_size: int = 500,
    overlap: int = 80
) -> List[Dict[str, Any]]:
    """
    Split text into overlapping semantic chunks.
    Prioritizes paragraph breaks, sentence boundaries, and word limits.
    """
    if not text or not text.strip():
        return []

    # Clean redundant whitespace
    text = text.strip()
    
    # Split by double newline (paragraphs) first
    paragraphs = [p.strip() for p in re.split(r'\n\s*\n', text) if p.strip()]
    
    chunks: List[Dict[str, Any]] = []
    current_chunk = ""
    chunk_idx = 0

    for para in paragraphs:
        # If single paragraph is larger than chunk_size, split by sentences
        if len(para) > chunk_size:
            sentences = [s.strip() for s in re.split(r'(?<=[.!?])\s+', para) if s.strip()]
            for sent in sentences:
                if len(current_chunk) + len(sent) + 1 <= chunk_size:
                    current_chunk = f"{current_chunk} {sent}".strip()
                else:
                    if current_chunk:
                        chunks.append({
                            "chunk_id": f"chunk_{chunk_idx}_{uuid.uuid4().hex[:8]}",
                            "index": chunk_idx,
                            "content": current_chunk,
                            "char_count": len(current_chunk)
                        })
                        chunk_idx += 1
                        # Retain overlap from end of current chunk
                        overlap_tail = current_chunk[-overlap:] if len(current_chunk) > overlap else current_chunk
                        current_chunk = f"{overlap_tail} {sent}".strip()
                    else:
                        current_chunk = sent
        else:
            if len(current_chunk) + len(para) + 2 <= chunk_size:
                current_chunk = f"{current_chunk}\n\n{para}".strip() if current_chunk else para
            else:
                if current_chunk:
                    chunks.append({
                        "chunk_id": f"chunk_{chunk_idx}_{uuid.uuid4().hex[:8]}",
                        "index": chunk_idx,
                        "content": current_chunk,
                        "char_count": len(current_chunk)
                    })
                    chunk_idx += 1
                    overlap_tail = current_chunk[-overlap:] if len(current_chunk) > overlap else current_chunk
                    current_chunk = f"{overlap_tail}\n\n{para}".strip()
                else:
                    current_chunk = para

    if current_chunk:
        chunks.append({
            "chunk_id": f"chunk_{chunk_idx}_{uuid.uuid4().hex[:8]}",
            "index": chunk_idx,
            "content": current_chunk,
            "char_count": len(current_chunk)
        })

    return chunks
