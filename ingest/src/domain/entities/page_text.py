from dataclasses import dataclass


@dataclass(frozen=True)
class PageText:
    page: int
    text: str
