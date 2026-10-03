import os
from dataclasses import dataclass


DEFAULT_MODEL_ID = "global.anthropic.claude-sonnet-4-5-20250929-v1:0"
DEFAULT_EMBEDDING_MODEL_ID = "amazon.titan-embed-text-v2:0"

TUTOR_MAX_OUTPUT_TOKENS = 4096


@dataclass(frozen=True)
class Settings:
    aws_region: str
    guardrail_id: str | None
    guardrail_version: str | None
    model_id: str
    vector_bucket_name: str
    vector_index_name: str
    embedding_model_id: str
    agentcore_memory_id: str | None


def load_settings() -> Settings:
    return Settings(
        aws_region=os.environ.get("AWS_REGION", "us-east-1"),
        guardrail_id=os.environ.get("GUARDRAIL_ID"),
        guardrail_version=os.environ.get("GUARDRAIL_VERSION", "DRAFT"),
        model_id=os.environ.get("MODEL_ID", DEFAULT_MODEL_ID),
        vector_bucket_name=os.environ.get("VECTOR_BUCKET", "finantutor-vectors-dev"),
        vector_index_name=os.environ.get("VECTOR_INDEX", "books"),
        embedding_model_id=os.environ.get(
            "EMBEDDING_MODEL_ID", DEFAULT_EMBEDDING_MODEL_ID
        ),
        agentcore_memory_id=os.environ.get("AGENTCORE_MEMORY_ID") or None,
    )
