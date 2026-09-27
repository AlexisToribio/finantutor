from unittest.mock import Mock

from finantutor_ingest.infrastructure.aws import IngestWorker


def worker():
    instance = IngestWorker.__new__(IngestWorker)
    instance.bedrock = Mock()
    instance.table = Mock()
    instance._material = Mock(return_value={"pk": "owner", "sk": "material"})
    instance.update = Mock()
    return instance


def test_complete_job_with_document_failures_is_not_ready(monkeypatch):
    monkeypatch.setenv("KNOWLEDGE_BASE_ID", "ABCDEFGHIJ")
    monkeypatch.setenv("DATA_SOURCE_ID", "KLMNOPQRST")
    instance = worker()
    instance.bedrock.get_ingestion_job.return_value = {
        "ingestionJob": {"status": "COMPLETE", "statistics": {"numberOfDocumentsFailed": 1}}
    }
    event = instance.poll({"key": "source", "job_id": "UVWXYZ1234"})
    assert instance.finish(event)["status"] == "failed"
    assert instance.update.call_args.kwargs["status"] == "failed"


def test_complete_job_is_ready():
    instance = worker()
    assert (
        instance.finish({"key": "source", "job_status": "COMPLETE", "documents_failed": 0})[
            "status"
        ]
        == "ready"
    )


def test_workflow_failure_marks_unfinished_material_failed():
    instance = worker()
    instance.states = Mock()
    instance.states.describe_execution.return_value = {
        "input": '{"key":"incoming/owner/course/material/source.pdf"}'
    }
    assert (
        instance.execution_failed({"detail": {"executionArn": "execution"}})["status"] == "failed"
    )
    assert instance.table.update_item.call_args.kwargs["ConditionExpression"] == "#status <> :ready"


def test_duplicate_failure_does_not_replace_a_ready_material():
    instance = worker()
    instance._material.return_value["status"] = "ready"
    assert instance.finish({"key": "source", "failed": True})["status"] == "ready"
    instance.update.assert_not_called()
