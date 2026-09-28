from dataclasses import dataclass

from domain.entities.course import Course


@dataclass(frozen=True)
class Passage:
    text: str
    book_title: str
    source_key: str
    page: int | None = None
    score: float | None = None
    subject: Course | None = None
