from botocore.config import Config
from strands.models import BedrockModel

from infrastructure.config.settings import DEFAULT_MODEL_ID

# https://docs.aws.amazon.com/bedrock/latest/userguide/inference-profiles-support.html


def load_model(
    model_id: str = DEFAULT_MODEL_ID,
    guardrail_id: str | None = None,
    guardrail_version: str | None = None,
    max_tokens: int = 4096,
) -> BedrockModel:
    """
    Instantiate a BedrockModel, optionally configured with a Bedrock Guardrail.
    Uses IAM authentication via the execution role.
    """
    model_options = {
        "model_id": model_id,
        "max_tokens": max_tokens,
        "boto_client_config": Config(
            connect_timeout=5,
            read_timeout=45,
            retries={"total_max_attempts": 3, "mode": "adaptive"},
        ),
    }
    if not guardrail_id:
        return BedrockModel(**model_options)

    return BedrockModel(
        **model_options,
        guardrail_id=guardrail_id,
        guardrail_version=guardrail_version or "DRAFT",
        guardrail_trace="enabled",
    )
