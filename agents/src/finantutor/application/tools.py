import json
from typing import Any

from finantutor.domain.finance import calculate
from finantutor.domain.ports import MaterialRetriever


class TutorTools:
    """Estado de un turno; el modelo no elige propietario ni curso."""

    def __init__(
        self, scope: dict[str, Any], retriever: MaterialRetriever, budget: int = 12
    ) -> None:
        self.scope, self.retriever, self.budget = scope, retriever, budget
        self.references: dict[str, dict[str, Any]] = {}
        self.activities: list[dict[str, Any]] = []

    def spend(self) -> None:
        if self.budget <= 0:
            raise ValueError("Límite de herramientas alcanzado. Resume el avance y pide continuar.")
        self.budget -= 1

    def search(self, query: str, unit: str | None = None) -> list[dict[str, Any]]:
        self.spend()
        if not query.strip() or len(query) > 2000:
            raise ValueError("Consulta vacía o demasiado larga.")
        results = self.retriever.search(query, self.scope, unit)
        sourced = []
        for result in results:
            item = {k: v for k, v in result.items() if k != "source_id"}
            key = next((key for key, ref in self.references.items() if ref == item), None)
            key = key or f"S{len(self.references) + 1}"
            self.references[key] = dict(item)
            sourced.append({**item, "source_id": key})
        return sourced

    def financial_metric(self, operation: str, parameters_json: str) -> dict[str, Any]:
        self.spend()
        if len(parameters_json) > 10000:
            raise ValueError("Parámetros demasiado grandes.")
        parameters = json.loads(parameters_json)
        if not isinstance(parameters, dict):
            raise ValueError("Los parámetros deben ser un objeto JSON.")
        return calculate(operation, parameters)

    def record_activity(self, topic: str, outcome: str, evidence: str) -> dict[str, Any]:
        self.spend()
        if (
            outcome not in ("studied", "practiced", "needs_review")
            or not 1 <= len(topic.strip()) <= 200
            or not 1 <= len(evidence.strip()) <= 500
        ):
            raise ValueError(
                "Actividad inválida; incluye tema y evidencia explícita de la interacción."
            )
        activity = {"topic": topic.strip(), "outcome": outcome, "evidence": evidence.strip()}
        self.activities.append(activity)
        return {"status": "pending_commit", **activity}
