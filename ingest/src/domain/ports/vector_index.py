from abc import ABC, abstractmethod
from typing import Any

from domain.entities.vector_record import VectorRecord


class VectorIndex(ABC):
    @abstractmethod
    def upsert(self, vectors: list[VectorRecord]) -> None:
        """Insert or replace vectors in the index."""

    @abstractmethod
    def query(
        self,
        vector: list[float],
        top_k: int = 5,
        metadata_filter: dict[str, Any] | None = None,
    ) -> list[VectorRecord]:
        """Return nearest neighbors. Distance is stored in metadata['distance'] if available."""
