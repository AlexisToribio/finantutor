import json
from pathlib import Path
from uuid import uuid4

import pytest

from finantutor.application.tools import TutorTools
from finantutor.infrastructure.retrieval import LocalRetriever


def test_local_search_does_not_cross_owner_or_course(tmp_path: Path):
    material = str(uuid4())
    (tmp_path / "index").mkdir()
    (tmp_path / "index" / f"{material}.json").write_text(
        json.dumps(
            {
                "owner_id": "other",
                "course_id": "course",
                "title": "VAN",
                "version": 1,
                "pages": [{"number": 1, "text": "Valor actual neto de proyectos"}],
            }
        )
    )
    scope = {"owner_id": "me", "course_id": "course", "materials": [{"id": material}]}
    assert LocalRetriever(tmp_path).search("valor actual", scope) == []


def test_sources_come_from_retrieval_and_budget_is_bounded():
    class Retriever:
        def search(self, query, scope, unit=None):
            return [
                {"material_id": "one", "title": "Material", "page": 3, "version": 1, "text": "VAN"}
            ]

    tools = TutorTools({"owner_id": "me"}, Retriever(), budget=1)
    assert tools.search("VAN")[0]["source_id"] == "S1"
    assert tools.references["S1"]["page"] == 3
    with pytest.raises(ValueError, match="Límite"):
        tools.search("VAN")


def test_progress_needs_explicit_evidence():
    tools = TutorTools({}, LocalRetriever(Path(".")))
    with pytest.raises(ValueError):
        tools.record_activity("VAN", "mastered", "Nada")
    with pytest.raises(ValueError):
        tools.record_activity("VAN", "studied", "")
    assert (
        tools.record_activity("VAN", "practiced", "Resolvió un ejemplo")["status"]
        == "pending_commit"
    )


def test_calculator_does_not_evaluate_expressions():
    tools = TutorTools({}, LocalRetriever(Path(".")))
    with pytest.raises(ValueError):
        tools.financial_metric(
            "npv",
            json.dumps(
                {
                    "cashflows": [-100, "__import__('os').system('id')"],
                    "rate": ".1",
                    "period": "year",
                    "currency": "PEN",
                }
            ),
        )


def test_repeated_sources_are_stable_and_do_not_mutate_adapter_results():
    item = {"material_id": "one", "title": "Material", "page": 3, "version": 1, "text": "VAN"}

    class Retriever:
        def search(self, query, scope, unit=None):
            return [item]

    tools = TutorTools({}, Retriever())
    assert tools.search("VAN")[0]["source_id"] == "S1"
    assert tools.search("VAN")[0]["source_id"] == "S1"
    assert len(tools.references) == 1
    assert "source_id" not in item
