import sys
from pathlib import Path
from unittest.mock import MagicMock

sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / "src"))

from domain.entities.course import Course
from domain.entities.vector_record import VectorRecord
from infrastructure.adapters.vector_passage_retriever import VectorPassageRetriever


def test_retriever_maps_metadata_to_passages():
    embedder = MagicMock()
    embedder.embed.return_value = [[0.2, 0.1]]
    index = MagicMock()
    index.query.return_value = [
        VectorRecord(
            key="chunk-1",
            values=[],
            metadata={
                "source_text": "El sujeto y el predicado.",
                "book_title": "Comunicación 2",
                "source_key": "books/x.pdf",
                "page": 3,
                "distance": 0.1,
                "subject": "modelos-financieros-y-evaluacion-de-proyectos",
            },
        )
    ]
    passages = VectorPassageRetriever(embedder, index).retrieve(
        "sujeto",
        subject=Course.parse("Modelos financieros y evaluación de proyectos"),
        top_k=3,
    )
    assert len(passages) == 1
    assert passages[0].book_title == "Comunicación 2"
    assert passages[0].page == 3
    assert passages[0].text.startswith("El sujeto")
    index.query.assert_called_once()
    assert index.query.call_args.kwargs["metadata_filter"] == {
        "subject": {"$eq": "modelos-financieros-y-evaluacion-de-proyectos"}
    }
