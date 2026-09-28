from __future__ import annotations

from typing import Any

import boto3

from domain.entities.vector_record import VectorRecord
from domain.ports.vector_index import VectorIndex


class S3VectorIndex(VectorIndex):
    def __init__(self, bucket: str, index_name: str, region: str) -> None:
        self._bucket = bucket
        self._index_name = index_name
        self._client = boto3.client("s3vectors", region_name=region)

    def query(
        self,
        vector: list[float],
        top_k: int = 5,
        metadata_filter: dict[str, Any] | None = None,
    ) -> list[VectorRecord]:
        params: dict[str, Any] = {
            "vectorBucketName": self._bucket,
            "indexName": self._index_name,
            "queryVector": {"float32": vector},
            "topK": top_k,
            "returnMetadata": True,
            "returnDistance": True,
        }
        if metadata_filter:
            params["filter"] = metadata_filter
        response = self._client.query_vectors(**params)
        records: list[VectorRecord] = []
        for item in response.get("vectors", []):
            metadata = dict(item.get("metadata") or {})
            if "distance" in item:
                metadata["distance"] = item["distance"]
            data = item.get("data") or {}
            values = list(data.get("float32") or [])
            records.append(
                VectorRecord(
                    key=item["key"],
                    values=values,
                    metadata=metadata,
                )
            )
        return records
