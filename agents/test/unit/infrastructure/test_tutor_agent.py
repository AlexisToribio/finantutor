from unittest.mock import MagicMock, patch

from infrastructure.adapters.llm.tutor_agent import TutorAgent


class _AgentResult:
    stop_reason = "end_turn"

    def __str__(self) -> str:
        return "respuesta"


def test_reply_applies_injected_limits_and_preserves_response_contract() -> None:
    strands_agent = MagicMock()
    limits = {"turns": 2, "output_tokens": 100, "total_tokens": 200}

    with (
        patch(
            "infrastructure.adapters.llm.tutor_agent.Agent",
            return_value=strands_agent,
        ),
        patch(
            "infrastructure.adapters.llm.tutor_agent.invoke_agent",
            return_value=_AgentResult(),
        ) as invoke,
    ):
        tutor = TutorAgent(
            MagicMock(),
            MagicMock(),
            limits=limits,
            timeout_seconds=12,
        )
        response = tutor.reply("session-1", "¿Qué es el VAN?", "student-1")

    invoke.assert_called_once_with(
        strands_agent,
        "¿Qué es el VAN?",
        role="tutor",
        limits=limits,
        timeout_seconds=12,
    )
    assert response == {"reply": "respuesta", "session_id": "session-1"}
