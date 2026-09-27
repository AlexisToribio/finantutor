"""Documento preparado para un índice que conserva páginas y versiones."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Page:
    number: int
    text: str


@dataclass(frozen=True)
class Document:
    checksum: str
    pages: list[Page]
    outline: list[dict[str, str]]
