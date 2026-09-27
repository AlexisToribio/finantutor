import os
from pathlib import Path
from uuid import UUID

from bedrock_agentcore.runtime import BedrockAgentCoreApp
from dotenv import load_dotenv

from finantutor.infrastructure.agent import stream_tutor
from finantutor.infrastructure.retrieval import LocalRetriever, S3VectorRetriever

load_dotenv(Path(__file__).with_name(".env"))
app = BedrockAgentCoreApp()
REGION = os.getenv("AWS_REGION", "us-east-1")
retriever = (
    S3VectorRetriever(
        vector_bucket=os.environ["VECTOR_BUCKET"],
        vector_index=os.environ["VECTOR_INDEX"],
        embedding_model_id=os.getenv("EMBEDDING_MODEL_ID", "amazon.titan-embed-text-v2:0"),
        region=REGION,
    )
    if os.getenv("VECTOR_BUCKET") and os.getenv("VECTOR_INDEX")
    else LocalRetriever(Path(os.getenv("LOCAL_DATA_DIR", "../.local")).resolve())
)


@app.entrypoint
async def invoke(payload: dict, context):
    try:
        scope = payload["scope"]
        UUID(scope["course_id"])
        if not isinstance(scope["owner_id"], str) or not scope["owner_id"]:
            raise ValueError("Invalid actor")
        if payload.get("mode") not in ("explain", "practice", "case", "review"):
            raise ValueError("Invalid mode")
        if not isinstance(payload.get("prompt"), str) or not 1 <= len(payload["prompt"]) <= 12000:
            raise ValueError("Invalid prompt")
        async for event in stream_tutor(payload, context.session_id, retriever):
            yield event
    except Exception:
        yield {"type": "error", "message": "No se pudo completar la solicitud."}


if __name__ == "__main__":
    app.run(host="0.0.0.0" if os.getenv("VECTOR_BUCKET") else "127.0.0.1")
