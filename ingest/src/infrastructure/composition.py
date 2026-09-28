from application.use_cases.ingest_book import IngestBookUseCase
from infrastructure.adapters.pypdf_parser import PypdfDocumentParser
from infrastructure.adapters.s3_book_archive import S3BookArchive
from infrastructure.adapters.s3_vector_index import S3VectorIndex
from infrastructure.adapters.titan_embeddings import TitanEmbeddingModel
from infrastructure.config.settings import Settings


def build_ingest_use_case(settings: Settings) -> IngestBookUseCase:
    return IngestBookUseCase(
        parser=PypdfDocumentParser(),
        archive=S3BookArchive(
            bucket=settings.books_bucket_name,
            region=settings.aws_region,
        ),
        embedder=TitanEmbeddingModel(
            model_id=settings.embedding_model_id,
            region=settings.aws_region,
        ),
        index=S3VectorIndex(
            bucket=settings.vector_bucket_name,
            index_name=settings.vector_index_name,
            region=settings.aws_region,
        ),
    )
