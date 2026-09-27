from typing import Any, Protocol


class MaterialRetriever(Protocol):
    def search(
        self, query: str, scope: dict[str, Any], unit: str | None = None
    ) -> list[dict[str, Any]]: ...
