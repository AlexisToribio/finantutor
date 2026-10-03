from unittest.mock import patch

from infrastructure.llm.load import load_model


def test_load_model_bounds_output_and_uses_adaptive_transport_retries() -> None:
    with patch("infrastructure.llm.load.BedrockModel") as model_class:
        load_model(model_id="test-model", max_tokens=512)

    options = model_class.call_args.kwargs
    assert options["max_tokens"] == 512
    config = options["boto_client_config"]
    assert config.connect_timeout == 5
    assert config.read_timeout == 45
    assert config.retries == {
        "total_max_attempts": 3,
        "mode": "adaptive",
    }
