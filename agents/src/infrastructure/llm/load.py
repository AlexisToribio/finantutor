from strands.models import BedrockModel

from infrastructure.config.settings import DEFAULT_MODEL_ID

# https://docs.aws.amazon.com/bedrock/latest/userguide/inference-profiles-support.html


def load_model(
    model_id: str = DEFAULT_MODEL_ID,
    guardrail_id: str | None = None,
    guardrail_version: str | None = None,
) -> BedrockModel:
    """
    Instantiate a BedrockModel, optionally configured with a Bedrock Guardrail.
    Uses IAM authentication via the execution role.
    """
    if not guardrail_id:
        return BedrockModel(model_id=model_id)

    return BedrockModel(
        model_id=model_id,
        guardrail_id=guardrail_id,
        guardrail_version=guardrail_version or "DRAFT",
        guardrail_trace="enabled",
    )
