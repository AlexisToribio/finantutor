from abc import ABC, abstractmethod


class BookArchive(ABC):
    @abstractmethod
    def save(self, book_id: str, filename: str, pdf_bytes: bytes) -> str:
        """Persist the original PDF and return its storage key."""
