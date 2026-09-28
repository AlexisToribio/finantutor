from __future__ import annotations

import json
from typing import Any

import boto3

from domain.ports.embedding_model import EmbeddingModel


class TitanEmbeddingModel(EmbeddingModel):
    def __init__(
        self,
        model_id: str,
        region: str,
        dimensions: int = 1024,
    ) -> None:
        self._model_id = model_id
        self._dimensions = dimensions
        self._client = boto3.client("bedrock-runtime", region_name=region)

    def embed(self, texts: list[str]) -> list[list[float]]:
        return [self._embed_one(text) for text in texts]

    def _embed_one(self, text: str) -> list[float]:
        body = json.dumps(
            {
                "inputText": text,
                "dimensions": self._dimensions,
                "normalize": True,
            }
        )
        response = self._client.invoke_model(
            modelId=self._model_id,
            contentType="application/json",
            accept="application/json",
            body=body,
        )
        payload: dict[str, Any] = json.loads(response["body"].read())
        embedding = payload.get("embedding")
        if not isinstance(embedding, list):
            raise ValueError("Bedrock embedding response missing vector")
        return [float(value) for value in embedding]
