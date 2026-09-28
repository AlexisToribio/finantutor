def chunk_text(text: str, size: int = 800, overlap: int = 100) -> list[str]:
    """Split text into overlapping windows. size/overlap are character counts."""
    cleaned = " ".join(text.split())
    if not cleaned:
        return []
    if len(cleaned) <= size:
        return [cleaned]
    if overlap >= size:
        raise ValueError("overlap must be smaller than size")

    chunks: list[str] = []
    start = 0
    while start < len(cleaned):
        end = min(start + size, len(cleaned))
        chunks.append(cleaned[start:end])
        if end == len(cleaned):
            break
        start = end - overlap
    return chunks
