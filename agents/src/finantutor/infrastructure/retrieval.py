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


class ManagedKnowledgeRetriever:
    def __init__(self, knowledge_base_id: str, region: str) -> None:
        self.knowledge_base_id = knowledge_base_id
        self.client = boto3.client(
            "bedrock-agent-runtime",
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
        filters = [
            {"equals": {"key": "owner_id", "value": scope["owner_id"]}},
            {"equals": {"key": "course_id", "value": scope["course_id"]}},
        ]
        if unit:
            filters.append({"equals": {"key": "unit", "value": unit}})
        response = self.client.retrieve(
            knowledgeBaseId=self.knowledge_base_id,
            retrievalQuery={"text": query},
            retrievalConfiguration={"managedSearchConfiguration": {"filter": {"andAll": filters}}},
        )
        allowed = {item["id"]: item for item in scope.get("materials", [])}
        hits = []
        for result in response.get("retrievalResults", []):
            metadata = result.get("metadata", {})
            material_id = metadata.get("material_id")
            material = allowed.get(material_id)
            # Defense in depth: server catalogue must declare this version ready.
            if (
                not material
                or metadata.get("owner_id") != scope["owner_id"]
                or metadata.get("course_id") != scope["course_id"]
            ):
                continue
            if str(metadata.get("version")) != str(material["version"]):
                continue
            text = result.get("content", {}).get("text", "")
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
