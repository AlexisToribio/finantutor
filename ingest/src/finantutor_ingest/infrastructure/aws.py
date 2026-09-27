"""Index uploaded course PDFs directly in Amazon S3 Vectors."""

from __future__ import annotations

import json
import logging
import os
from datetime import UTC, datetime
from typing import Any
from urllib.parse import unquote_plus

import boto3
from botocore.config import Config

from finantutor_ingest.application.prepare import MAX_BYTES, prepare_pdf

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

AWS_CONFIG = Config(
    connect_timeout=5,
    read_timeout=60,
    retries={"mode": "standard", "total_max_attempts": 3},
)
CHUNK_SIZE = 3200
CHUNK_OVERLAP = 300
VECTOR_BATCH_SIZE = 100


def _chunks(text: str) -> list[str]:
    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = min(start + CHUNK_SIZE, len(text))
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end == len(text):
            break
        start = end - CHUNK_OVERLAP
    return chunks


class IngestWorker:
    def __init__(self) -> None:
        region = os.getenv("AWS_REGION", "us-east-1")
        self.s3 = boto3.client("s3", region_name=region, config=AWS_CONFIG)
        self.bedrock = boto3.client("bedrock-runtime", region_name=region, config=AWS_CONFIG)
        self.vectors = boto3.client("s3vectors", region_name=region, config=AWS_CONFIG)
        self.table = boto3.resource("dynamodb", region_name=region, config=AWS_CONFIG).Table(
            os.environ["APP_TABLE"]
        )
        self.source_bucket = os.environ["MATERIALS_BUCKET"]
        self.vector_bucket = os.environ["VECTOR_BUCKET"]
        self.vector_index = os.environ["VECTOR_INDEX"]
        self.embedding_model_id = os.getenv(
            "EMBEDDING_MODEL_ID", "amazon.titan-embed-text-v2:0"
        )

    def _material(self, key: str) -> dict[str, Any]:
        parts = key.split("/")
        if len(parts) != 5 or parts[0] != "incoming" or parts[-1] != "source.pdf":
            raise ValueError("Unexpected material key")
        _, owner_id, course_id, material_id, _ = parts
        item = self.table.get_item(
            Key={"pk": f"course#{owner_id}#{course_id}", "sk": f"material#{material_id}"},
            ConsistentRead=True,
        ).get("Item")
        if (
            not item
            or item.get("raw_key") != key
            or item.get("owner_id") != owner_id
            or item.get("course_id") != course_id
        ):
            raise ValueError("Unknown material")
        return item

    def _update(self, item: dict[str, Any], **values: Any) -> None:
        names = {f"#n{i}": name for i, name in enumerate(values)}
        attrs = {f":v{i}": value for i, value in enumerate(values.values())}
        assignments = ", ".join(f"{names[f'#n{i}']} = :v{i}" for i in range(len(values)))
        self.table.update_item(
            Key={"pk": item["pk"], "sk": item["sk"]},
            UpdateExpression="SET " + assignments,
            ExpressionAttributeNames=names,
            ExpressionAttributeValues=attrs,
        )

    def _embed(self, text: str) -> list[float]:
        response = self.bedrock.invoke_model(
            modelId=self.embedding_model_id,
            contentType="application/json",
            accept="application/json",
            body=json.dumps({"inputText": text, "dimensions": 1024, "normalize": True}),
        )
        payload = json.loads(response["body"].read())
        embedding = payload.get("embedding")
        if not isinstance(embedding, list):
            raise ValueError("Bedrock embedding response missing vector")
        return [float(value) for value in embedding]

    def process(self, key: str) -> dict[str, Any]:
        key = unquote_plus(key)
        item = self._material(key)
        head = self.s3.head_object(Bucket=self.source_bucket, Key=key)
        if int(head["ContentLength"]) > MAX_BYTES:
            raise ValueError("PDF exceeds upload limit")
        response = self.s3.get_object(Bucket=self.source_bucket, Key=key)
        try:
            data = response["Body"].read(MAX_BYTES + 1)
        finally:
            response["Body"].close()
        document = prepare_pdf(data, item.get("kind", "theory"))
        if item.get("status") == "ready" and item.get("checksum") == document.checksum:
            return {"material_id": item["id"], "status": "ready", "duplicate": True}

        self._update(
            item,
            status="indexing",
            checksum=document.checksum,
            page_count=len(document.pages),
            error="",
        )
        material_prefix = f"{item['owner_id']}#{item['course_id']}#{item['id']}#v{item['version']}"
        records: list[dict[str, Any]] = []
        chunk_number = 0
        for page in document.pages:
            for chunk in _chunks(page.text):
                vector_key = f"{material_prefix}#p{page.number:04d}#c{chunk_number:06d}"
                records.append(
                    {
                        "key": vector_key,
                        "data": {"float32": self._embed(chunk)},
                        "metadata": {
                            "owner_id": str(item["owner_id"]),
                            "course_id": str(item["course_id"]),
                            "material_id": str(item["id"]),
                            "version": str(item["version"]),
                            "title": str(item["title"]),
                            "kind": str(item["kind"]),
                            "unit": str(item.get("unit", "")),
                            "page": page.number,
                            "source_text": chunk,
                        },
                    }
                )
                chunk_number += 1

        if not records:
            raise ValueError("PDF has no indexable text")
        for start in range(0, len(records), VECTOR_BATCH_SIZE):
            self.vectors.put_vectors(
                vectorBucketName=self.vector_bucket,
                indexName=self.vector_index,
                vectors=records[start : start + VECTOR_BATCH_SIZE],
            )
        self._update(
            item,
            status="ready",
            checksum=document.checksum,
            page_count=len(document.pages),
            vector_count=len(records),
            indexed_at=datetime.now(UTC).isoformat(),
            error="",
        )
        logger.info(
            json.dumps(
                {
                    "event": "material_indexed",
                    "material_id": item["id"],
                    "course_id": item["course_id"],
                    "pages": len(document.pages),
                    "vectors": len(records),
                }
            )
        )
        return {"material_id": item["id"], "status": "ready", "vectors": len(records)}


_worker: IngestWorker | None = None


def handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    global _worker
    if _worker is None:
        _worker = IngestWorker()
    results = []
    for record in event.get("Records", []):
        key = record.get("s3", {}).get("object", {}).get("key")
        if not key:
            continue
        try:
            results.append(_worker.process(key))
        except Exception:
            logger.exception("material_ingest_failed key=%s", key)
            try:
                material = _worker._material(unquote_plus(key))
                _worker._update(
                    material,
                    status="failed",
                    error="No se pudo indexar el PDF. Verifica el archivo e inténtalo de nuevo.",
                )
            except Exception:
                logger.exception("material_ingest_status_update_failed key=%s", key)
            raise
    return {"processed": results}
