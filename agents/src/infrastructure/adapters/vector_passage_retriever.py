from __future__ import annotations

from typing import Any

from domain.entities.course import Course
from domain.entities.passage import Passage
from domain.ports.embedding_model import EmbeddingModel
from domain.ports.passage_retriever import PassageRetriever
from domain.ports.vector_index import VectorIndex


class VectorPassageRetriever(PassageRetriever):
    def __init__(self, embedder: EmbeddingModel, index: VectorIndex) -> None:
        self._embedder = embedder
        self._index = index

    def retrieve(
        self,
        query: str,
        subject: Course | None = None,
        top_k: int = 5,
    ) -> list[Passage]:
        embeddings = self._embedder.embed([query])
        if not embeddings:
            return []
        metadata_filter = _metadata_filter(subject)
        records = self._index.query(
            embeddings[0],
            top_k=top_k,
            metadata_filter=metadata_filter,
        )
        passages: list[Passage] = []
        for record in records:
            meta = record.metadata
            text = str(meta.get("source_text") or "")
            if not text:
                continue
            distance = meta.get("distance")
            score = None if distance is None else 1.0 - float(distance)
            passages.append(
                Passage(
                    text=text,
                    book_title=str(meta.get("book_title") or ""),
                    source_key=str(meta.get("source_key") or ""),
                    page=_optional_int(meta.get("page")),
                    score=score,
                    subject=_optional_subject(meta.get("subject")),
                )
            )
        return passages


def _metadata_filter(subject: Course | None) -> dict[str, Any] | None:
    if subject is None:
        return None
    return {"subject": {"$eq": subject.slug}}


def _optional_int(value: object) -> int | None:
    if isinstance(value, bool) or not isinstance(value, int):
        return None
    return value


def _optional_subject(value: object) -> Course | None:
    try:
        return Course.parse(str(value))
    except ValueError:
        return None
