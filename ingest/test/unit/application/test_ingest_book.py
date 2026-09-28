import sys
from pathlib import Path
from unittest.mock import MagicMock

sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / "src"))

import pytest

from application.use_cases.ingest_book import IngestBookRequest, IngestBookUseCase
from domain.entities.page_text import PageText


def test_ingest_indexes_finance_course_material():
    parser = MagicMock()
    parser.parse.return_value = [
        PageText(page=1, text="Las fracciones representan partes de un entero.")
    ]
    archive = MagicMock()
    archive.save.return_value = "books/abc.pdf"
    embedder = MagicMock()
    embedder.embed.return_value = [[0.1, 0.2]]
    index = MagicMock()

    result = IngestBookUseCase(parser, archive, embedder, index).execute(
        IngestBookRequest(
            filename="fracciones.pdf",
            title="Mate 3",
            subject="matematicas",
            pdf_bytes=b"%PDF",
        )
    )

    assert result.chunk_count == 1
    assert result.source_key == "books/abc.pdf"
    archive.save.assert_called_once()
    index.upsert.assert_called_once()
    records = index.upsert.call_args[0][0]
    assert records[0].metadata["book_title"] == "Mate 3"
    assert records[0].metadata["subject"] == "matematicas"
    assert records[0].metadata["source_text"].startswith("Las fracciones")


def test_ingest_slugs_free_text_course():
    parser = MagicMock()
    parser.parse.return_value = [PageText(page=1, text="Calentamiento y juego.")]
    archive = MagicMock()
    archive.save.return_value = "books/ef.pdf"
    embedder = MagicMock()
    embedder.embed.return_value = [[0.1, 0.2]]
    index = MagicMock()

    IngestBookUseCase(parser, archive, embedder, index).execute(
        IngestBookRequest(
            filename="ef.pdf",
            title="Ed. física 3",
            subject="Educación Física",
            pdf_bytes=b"%PDF",
        )
    )

    records = index.upsert.call_args[0][0]
    assert records[0].metadata["subject"] == "educacion-fisica"
    assert records[0].metadata["subject_name"] == "Educación Física"


def test_ingest_rejects_empty_pdf():
    parser = MagicMock()
    parser.parse.return_value = []
    with pytest.raises(ValueError, match="no extractable text"):
        IngestBookUseCase(parser, MagicMock(), MagicMock(), MagicMock()).execute(
            IngestBookRequest(
                filename="empty.pdf",
                title="X",
                subject="matematicas",
                pdf_bytes=b"%PDF",
            )
        )
