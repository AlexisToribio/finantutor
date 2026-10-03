import logging
import sys
from pathlib import Path

_SRC = Path(__file__).resolve().parent / "src"
if str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))

from bedrock_agentcore.runtime import BedrockAgentCoreApp
from dotenv import load_dotenv

from application.dispatch import dispatch
from infrastructure.composition import (
    build_tutor,
    build_retriever,
)
from infrastructure.config.settings import TUTOR_MAX_OUTPUT_TOKENS, load_settings
from infrastructure.llm.load import load_model
from infrastructure.logger import logger
from infrastructure.runtime.chat_stream import chat_events

load_dotenv(Path(__file__).resolve().parent / ".env")

app = BedrockAgentCoreApp()
log = app.logger

logging.basicConfig(level=logging.INFO)


def _session_id(context: object) -> str:
    session = getattr(context, "session_id", None)
    if isinstance(session, str) and session.strip():
        return session.strip()
    return "default"


_settings = load_settings()
_retriever = build_retriever(_settings)
_guardrail = {
    "guardrail_id": _settings.guardrail_id,
    "guardrail_version": _settings.guardrail_version,
}
_model = load_model(
    model_id=_settings.model_id,
    max_tokens=TUTOR_MAX_OUTPUT_TOKENS,
    **_guardrail,
)
_tutor = build_tutor(
    _settings,
    model=_model,
    retriever=_retriever,
)


@app.entrypoint
async def invoke(payload: dict, context):
    """
    Entrypoint for the Finantutor course tutor.

    {"prompt": "¿Cómo se interpreta el VAN de un proyecto?"}
    """
    session_id = _session_id(context)
    body = payload if isinstance(payload, dict) else {}
    keys = sorted(str(key) for key in body.keys())
    logger.info(
        "runtime.received",
        session_id=session_id,
        payload_keys=keys,
        payload_type=type(payload).__name__,
    )

    def run() -> dict:
        return dispatch(body, chat=_tutor, session_id=session_id)

    async for event in chat_events(run):
        yield event


if __name__ == "__main__":
    app.run()
