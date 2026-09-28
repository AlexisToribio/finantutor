from abc import ABC, abstractmethod

from domain.entities.page_text import PageText


class DocumentParser(ABC):
    @abstractmethod
    def parse(self, pdf_bytes: bytes) -> list[PageText]:
        """Extract text per page from a PDF."""
