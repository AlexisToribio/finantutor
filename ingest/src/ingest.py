from __future__ import annotations

import json
import logging
from urllib.parse import unquote_plus

import boto3

from application.use_cases.ingest_book import IngestBookRequest, IngestBookUseCase
from infrastructure.composition import build_ingest_use_case
from infrastructure.config.settings import load_settings
from infrastructure.logger import logger

MAX_PDF_BYTES = 50 * 1024 * 1024

log = logging.getLogger()
log.setLevel(logging.INFO)

_s3 = boto3.client("s3")


def _use_case() -> IngestBookUseCase:
    return build_ingest_use_case(load_settings())


def _incoming_keys(pdf_key: str) -> tuple[str, str]:
    if not pdf_key.startswith("incoming/") or not pdf_key.endswith(".pdf"):
        raise ValueError("not an incoming pdf")
    return pdf_key, pdf_key[: -len(".pdf")] + ".json"


def _get_bytes(bucket: str, key: str) -> bytes:
    return _s3.get_object(Bucket=bucket, Key=key)["Body"].read()


def _delete(bucket: str, *keys: str) -> None:
    for key in keys:
        _s3.delete_object(Bucket=bucket, Key=key)


def ingest_record(
    bucket: str,
    pdf_key: str,
    ingest: IngestBookUseCase | None = None,
) -> dict[str, object]:
    pdf_key, json_key = _incoming_keys(pdf_key)
    logger.info("ingest.received", bucket=bucket, pdf_key=pdf_key, json_key=json_key)
    meta = json.loads(_get_bytes(bucket, json_key).decode("utf-8"))
    pdf_bytes = _get_bytes(bucket, pdf_key)
    logger.info(
        "ingest.metadata",
        bucket=bucket,
        pdf_key=pdf_key,
        filename=str(meta.get("filename") or ""),
        title=str(meta.get("title") or ""),
        subject=str(meta.get("subject") or ""),
        user_id=str(meta.get("user_id") or ""),
        pdf_bytes=len(pdf_bytes),
    )
    if not pdf_bytes or len(pdf_bytes) > MAX_PDF_BYTES:
        raise ValueError("PDF exceeds size limit")
    if ingest is None:
        ingest = _use_case()
    result = ingest.execute(
        IngestBookRequest(
            filename=str(meta.get("filename") or "book.pdf"),
            title=str(meta.get("title") or ""),
            subject=str(meta.get("subject") or ""),
            pdf_bytes=pdf_bytes,
        )
    )
    _delete(bucket, pdf_key, json_key)
    payload = {
        "book_id": result.book_id,
        "source_key": result.source_key,
        "chunk_count": result.chunk_count,
    }
    logger.info("ingest.responded", bucket=bucket, pdf_key=pdf_key, **payload)
    return payload


def handler(event: dict, _context: object) -> dict[str, object]:
    records = event.get("Records") or []
    logger.info("handler.received", record_count=len(records))
    results = []
    for record in records:
        bucket = record["s3"]["bucket"]["name"]
        key = unquote_plus(record["s3"]["object"]["key"])
        if not key.startswith("incoming/") or not key.endswith(".pdf"):
            logger.warning("handler.skipped", bucket=bucket, key=key, reason="not_incoming_pdf")
            continue
        try:
            results.append(ingest_record(bucket, key))
        except Exception:
            logger.exception("ingest.failed", bucket=bucket, pdf_key=key)
            raise
    logger.info("handler.responded", ingested=len(results))
    return {"ingested": results}
