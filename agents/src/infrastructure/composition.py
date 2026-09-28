from strands.models import BedrockModel

from infrastructure.adapters.llm.tutor_agent import TutorAgent
from infrastructure.adapters.s3_vector_index import S3VectorIndex
from infrastructure.adapters.titan_embeddings import TitanEmbeddingModel
from infrastructure.adapters.vector_passage_retriever import VectorPassageRetriever
from infrastructure.config.settings import Settings


def build_retriever(settings: Settings) -> VectorPassageRetriever:
    embedder = TitanEmbeddingModel(
        model_id=settings.embedding_model_id,
        region=settings.aws_region,
    )
    index = S3VectorIndex(
        bucket=settings.vector_bucket_name,
        index_name=settings.vector_index_name,
        region=settings.aws_region,
    )
    return VectorPassageRetriever(embedder=embedder, index=index)


def build_tutor(
    settings: Settings,
    model: BedrockModel,
    retriever: VectorPassageRetriever,
) -> TutorAgent:
    return TutorAgent(
        model=model,
        retriever=retriever,
        memory_id=settings.agentcore_memory_id,
        aws_region=settings.aws_region,
    )
