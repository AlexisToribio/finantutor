import boto3
from botocore.stub import Stubber

from finantutor.infrastructure.retrieval import ManagedKnowledgeRetriever


def test_managed_search_filters_owner_and_course_and_rechecks_ready_catalogue():
    retriever = ManagedKnowledgeRetriever.__new__(ManagedKnowledgeRetriever)
    retriever.knowledge_base_id = "ABCDEFGHIJ"
    retriever.client = boto3.client(
        "bedrock-agent-runtime",
        region_name="us-east-1",
        aws_access_key_id="testing",
        aws_secret_access_key="testing",
    )
    allowed = {"id": "material", "version": 1, "title": "Teoría"}
    scope = {"owner_id": "student", "course_id": "course", "materials": [allowed]}
    metadata = {
        "owner_id": "student",
        "course_id": "course",
        "material_id": "material",
        "version": "1",
        "page": 2,
    }
    response = {
        "retrievalResults": [
            {"content": {"text": "Valor actual neto"}, "metadata": metadata},
            {
                "content": {"text": "Un resultado ajeno"},
                "metadata": {**metadata, "owner_id": "other"},
            },
            {"content": {"text": "Versión pendiente"}, "metadata": {**metadata, "version": "2"}},
        ]
    }
    expected = {
        "knowledgeBaseId": "ABCDEFGHIJ",
        "retrievalQuery": {"text": "VAN"},
        "retrievalConfiguration": {
            "managedSearchConfiguration": {
                "filter": {
                    "andAll": [
                        {"equals": {"key": "owner_id", "value": "student"}},
                        {"equals": {"key": "course_id", "value": "course"}},
                    ]
                }
            }
        },
    }
    with Stubber(retriever.client) as stub:
        stub.add_response("retrieve", response, expected)
        results = retriever.search("VAN", scope)
        stub.assert_no_pending_responses()
    assert len(results) == 1
    assert results[0]["page"] == 2
    assert results[0]["title"] == "Teoría"
