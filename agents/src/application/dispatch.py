from __future__ import annotations

from typing import Any, Mapping

from domain.ports.chat_assistant import ChatAssistant
from infrastructure.logger import logger

DEFAULT_ACTOR_ID = "finantutor-student"

_MISSING = {
    "error": "Send a chat message in prompt or message",
    "example": {
        "prompt": "¿Cómo se interpreta el VAN de un proyecto?",
    },
}


def _chat_message(payload: Mapping[str, object]) -> str | None:
    for key in ("prompt", "message"):
        value = payload.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def _actor_id(payload: Mapping[str, object]) -> str:
    value = payload.get("actor_id")
    if isinstance(value, str) and value.strip():
        return value.strip()
    return DEFAULT_ACTOR_ID


def dispatch(
    payload: Mapping[str, object],
    *,
    chat: ChatAssistant,
    session_id: str,
) -> dict[str, Any]:
    message = _chat_message(payload)
    if message is None:
        logger.warning(
            "dispatch.rejected",
            session_id=session_id,
            payload_keys=sorted(str(key) for key in payload.keys()),
            reason="missing_prompt",
        )
        return dict(_MISSING)
    actor_id = _actor_id(payload)
    logger.info(
        "dispatch.received",
        session_id=session_id,
        actor_id=actor_id,
        prompt_chars=len(message),
        prompt_preview=message[:120],
        payload_keys=sorted(str(key) for key in payload.keys()),
    )
    result = chat.reply(session_id, message, actor_id)
    reply = result.get("reply")
    logger.info(
        "dispatch.responded",
        session_id=session_id,
        actor_id=actor_id,
        keys=sorted(str(key) for key in result.keys()),
        reply_chars=len(reply) if isinstance(reply, str) else 0,
    )
    return result
