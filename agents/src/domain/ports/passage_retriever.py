from abc import ABC, abstractmethod

from domain.entities.course import Course
from domain.entities.passage import Passage


class PassageRetriever(ABC):
    @abstractmethod
    def retrieve(
        self,
        query: str,
        subject: Course | None = None,
        top_k: int = 5,
    ) -> list[Passage]:
        """Return relevant course passages, optionally filtered by subject."""
