from __future__ import annotations

import uuid
from dataclasses import dataclass

from application.chunking import chunk_text
from domain.entities.course import Course
from domain.entities.vector_record import VectorRecord
from domain.ports.book_archive import BookArchive
from domain.ports.document_parser import DocumentParser
from domain.ports.embedding_model import EmbeddingModel
from domain.ports.vector_index import VectorIndex
from infrastructure.logger import logger


@dataclass
class IngestBookRequest:
    filename: str
    title: str
    subject: str
    pdf_bytes: bytes


@dataclass
class IngestBookResult:
    book_id: str
    source_key: str
    chunk_count: int


class IngestBookUseCase:
    def __init__(
        self,
        parser: DocumentParser,
        archive: BookArchive,
        embedder: EmbeddingModel,
        index: VectorIndex,
    ) -> None:
        self._parser = parser
        self._archive = archive
        self._embedder = embedder
        self._index = index

    def execute(self, request: IngestBookRequest) -> IngestBookResult:
        logger.info(
            "ingest.process.parse",
            filename=request.filename,
            title=request.title,
            subject=request.subject,
            pdf_bytes=len(request.pdf_bytes),
        )
        subject = Course.parse(request.subject)
        pages = self._parser.parse(request.pdf_bytes)
        if not pages:
            raise ValueError("PDF has no extractable text")
        logger.info("ingest.process.parsed", filename=request.filename, pages=len(pages))

        book_id = str(uuid.uuid4())
        source_key = self._archive.save(book_id, request.filename, request.pdf_bytes)
        logger.info("ingest.process.archived", book_id=book_id, source_key=source_key)

        chunks: list[tuple[int, str]] = []
        for page in pages:
            for piece in chunk_text(page.text):
                chunks.append((page.page, piece))
        if not chunks:
            raise ValueError("PDF has no extractable text")
        logger.info("ingest.process.chunked", book_id=book_id, chunks=len(chunks))

        embeddings = self._embedder.embed([text for _, text in chunks])
        records = [
            VectorRecord(
                key=f"{book_id}-{index}",
                values=vector,
                metadata={
                    "subject": subject.slug,
                    "subject_name": subject.name,
                    "book_title": request.title,
                    "page": page,
                    "source_key": source_key,
                    "source_text": text,
                },
            )
            for index, ((page, text), vector) in enumerate(zip(chunks, embeddings))
        ]
        self._index.upsert(records)
        logger.info(
            "ingest.process.indexed",
            book_id=book_id,
            source_key=source_key,
            chunk_count=len(records),
        )
        return IngestBookResult(
            book_id=book_id,
            source_key=source_key,
            chunk_count=len(records),
        )
