import os
from dataclasses import dataclass


DEFAULT_EMBEDDING_MODEL_ID = "amazon.titan-embed-text-v2:0"


@dataclass(frozen=True)
class Settings:
    aws_region: str
    books_bucket_name: str
    vector_bucket_name: str
    vector_index_name: str
    embedding_model_id: str


def load_settings() -> Settings:
    return Settings(
        aws_region=os.environ.get("AWS_REGION", "us-east-1"),
        books_bucket_name=os.environ.get("BOOKS_BUCKET", "finantutor-books-dev"),
        vector_bucket_name=os.environ.get("VECTOR_BUCKET", "finantutor-vectors-dev"),
        vector_index_name=os.environ.get("VECTOR_INDEX", "books"),
        embedding_model_id=os.environ.get(
            "EMBEDDING_MODEL_ID", DEFAULT_EMBEDDING_MODEL_ID
        ),
    )
