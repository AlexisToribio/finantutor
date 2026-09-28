from dataclasses import dataclass, field
from typing import Any


@dataclass
class VectorRecord:
    key: str
    values: list[float]
    metadata: dict[str, Any] = field(default_factory=dict)
