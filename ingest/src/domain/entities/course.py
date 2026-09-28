from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass

_MAX_NAME = 80


def _slugify(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", value)
    ascii_text = decomposed.encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_text.lower()).strip("-")
    if not slug:
        raise ValueError("Course name must include letters or numbers")
    return slug[:_MAX_NAME]


@dataclass(frozen=True)
class Course:
    name: str
    slug: str

    @classmethod
    def parse(cls, value: str) -> "Course":
        name = " ".join(value.split())
        if not name:
            raise ValueError("Course is required")
        if len(name) > _MAX_NAME:
            raise ValueError("Course is too long")
        return cls(name=name, slug=_slugify(name))

    @property
    def display_name(self) -> str:
        return self.name
