import json
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / "src"))

from application.use_cases.ingest_book import IngestBookResult
from ingest import handler, ingest_record


def test_ingest_record_runs_use_case_and_deletes_incoming():
    ingest = MagicMock()
    ingest.execute.return_value = IngestBookResult(
        book_id="abc",
        source_key="books/abc.pdf",
        chunk_count=3,
    )
    meta = {
        "filename": "fracciones.pdf",
        "title": "Modelos financieros",
        "subject": "Modelos financieros y evaluación de proyectos",
        "user_id": "teacher-1",
    }
    pdf = b"%PDF-1.4"
    with (
        patch("ingest._get_bytes", side_effect=[json.dumps(meta).encode(), pdf]),
        patch("ingest._delete") as delete,
    ):
        result = ingest_record(
            "finantutor-books-dev",
            "incoming/teacher-1/uuid-1.pdf",
            ingest=ingest,
        )

    assert result == {
        "book_id": "abc",
        "source_key": "books/abc.pdf",
        "chunk_count": 3,
    }
    request = ingest.execute.call_args[0][0]
    assert request.title == "Modelos financieros"
    assert request.subject == "Modelos financieros y evaluación de proyectos"
    assert request.pdf_bytes == pdf
    delete.assert_called_once_with(
        "finantutor-books-dev",
        "incoming/teacher-1/uuid-1.pdf",
        "incoming/teacher-1/uuid-1.json",
    )


def test_handler_skips_non_incoming_pdf():
    ingest = MagicMock()
    event = {
        "Records": [
            {
                "s3": {
                    "bucket": {"name": "b"},
                    "object": {"key": "books/abc.pdf"},
                }
            }
        ]
    }
    with patch("ingest.ingest_record", ingest):
        result = handler(event, None)
    assert result == {"ingested": []}
    ingest.assert_not_called()


def test_handler_decodes_s3_key():
    ingest = MagicMock(return_value={"book_id": "x"})
    event = {
        "Records": [
            {
                "s3": {
                    "bucket": {"name": "b"},
                    "object": {"key": "incoming/teacher-1/uuid%201.pdf"},
                }
            }
        ]
    }
    with patch("ingest.ingest_record", ingest):
        result = handler(event, None)
    ingest.assert_called_once_with("b", "incoming/teacher-1/uuid 1.pdf")
    assert result == {"ingested": [{"book_id": "x"}]}


def test_handler_logs_and_reraises_ingest_failure(caplog):
    caplog.set_level("INFO")
    event = {
        "Records": [
            {
                "s3": {
                    "bucket": {"name": "b"},
                    "object": {"key": "incoming/teacher-1/uuid-1.pdf"},
                }
            }
        ]
    }
    with (
        patch("ingest.ingest_record", side_effect=RuntimeError("s3 timeout")),
        pytest.raises(RuntimeError, match="s3 timeout"),
    ):
        handler(event, None)
    assert "ingest.failed" in caplog.text
    assert "incoming/teacher-1/uuid-1.pdf" in caplog.text


def test_ingest_record_rejects_oversized_pdf():
    ingest = MagicMock()
    meta = {
        "filename": "huge.pdf",
        "title": "Material del curso",
        "subject": "Modelos financieros y evaluación de proyectos",
        "user_id": "teacher-1",
    }
    with (
        patch(
            "ingest._get_bytes",
            side_effect=[json.dumps(meta).encode(), b"x" * (50 * 1024 * 1024 + 1)],
        ),
        patch("ingest._delete") as delete,
        pytest.raises(ValueError, match="size"),
    ):
        ingest_record(
            "finantutor-books-dev",
            "incoming/teacher-1/uuid-1.pdf",
            ingest=ingest,
        )
    ingest.execute.assert_not_called()
    delete.assert_not_called()
