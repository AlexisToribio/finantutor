"""Adaptadores de recuperación con ámbito fijado por el BFF autenticado."""

import json
import re
from pathlib import Path
from typing import Any
from uuid import UUID

import boto3
from botocore.config import Config


class LocalRetriever:
    def __init__(self, directory: Path) -> None:
        self.directory = directory

    def search(
        self, query: str, scope: dict[str, Any], unit: str | None = None
    ) -> list[dict[str, Any]]:
        words = set(re.findall(r"\w{3,}", query.lower()))
        hits = []
        for material in scope.get("materials", []):
            UUID(material["id"])
            path = self.directory / "index" / f"{material['id']}.json"
            if not path.exists():
                continue
            document = json.loads(path.read_text())
            if (
                document["owner_id"] != scope["owner_id"]
                or document["course_id"] != scope["course_id"]
            ):
                continue
            if unit and document.get("unit") != unit:
                continue
            for page in document["pages"]:
                score = sum(page["text"].lower().count(word) for word in words)
                if score:
                    hits.append(
                        {
                            "material_id": material["id"],
                            "title": document["title"],
                            "page": page["number"],
                            "version": document["version"],
                            "text": page["text"][:3500],
                            "_score": score,
                        }
                    )
        hits.sort(key=lambda item: item["_score"], reverse=True)
        return [{k: v for k, v in hit.items() if k != "_score"} for hit in hits[:6]]


class S3VectorRetriever:
    def __init__(
        self,
        vector_bucket: str,
        vector_index: str,
        embedding_model_id: str,
        region: str,
    ) -> None:
        self.vector_bucket = vector_bucket
        self.vector_index = vector_index
        self.embedding_model_id = embedding_model_id
        self.bedrock = boto3.client(
            "bedrock-runtime",
            region_name=region,
            config=Config(
                connect_timeout=5,
                read_timeout=30,
                retries={"mode": "standard", "total_max_attempts": 3},
            ),
        )
        self.vectors = boto3.client(
            "s3vectors",
            region_name=region,
            config=Config(
                connect_timeout=5,
                read_timeout=30,
                retries={"mode": "standard", "total_max_attempts": 3},
            ),
        )

    def search(
        self, query: str, scope: dict[str, Any], unit: str | None = None
    ) -> list[dict[str, Any]]:
        embedding_response = self.bedrock.invoke_model(
            modelId=self.embedding_model_id,
            contentType="application/json",
            accept="application/json",
            body=json.dumps({"inputText": query, "dimensions": 1024, "normalize": True}),
        )
        payload = json.loads(embedding_response["body"].read())
        embedding = payload.get("embedding")
        if not isinstance(embedding, list):
            raise ValueError("Bedrock embedding response missing vector")
        filters: list[dict[str, Any]] = [
            {"owner_id": {"$eq": scope["owner_id"]}},
            {"course_id": {"$eq": scope["course_id"]}},
        ]
        if unit:
            filters.append({"unit": {"$eq": unit}})
        response = self.vectors.query_vectors(
            vectorBucketName=self.vector_bucket,
            indexName=self.vector_index,
            queryVector={"float32": embedding},
            topK=24,
            filter={"$and": filters},
            returnMetadata=True,
            returnDistance=True,
        )
        allowed = {item["id"]: item for item in scope.get("materials", [])}
        hits = []
        for result in response.get("vectors", []):
            metadata = result.get("metadata", {})
            material_id = metadata.get("material_id")
            material = allowed.get(material_id)
            if (
                not material
                or metadata.get("owner_id") != scope["owner_id"]
                or metadata.get("course_id") != scope["course_id"]
            ):
                continue
            if str(metadata.get("version")) != str(material["version"]):
                continue
            text = metadata.get("source_text", "")
            if text:
                hits.append(
                    {
                        "material_id": material_id,
                        "title": material["title"],
                        "page": metadata.get("page"),
                        "version": material["version"],
                        "text": text[:3500],
                    }
                )
        return hits[:6]
