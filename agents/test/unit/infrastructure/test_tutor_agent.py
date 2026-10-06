from unittest.mock import MagicMock, patch

from strands.agent.conversation_manager import SlidingWindowConversationManager

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
        ) as agent_class,
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
    system_prompt = agent_class.call_args.kwargs["system_prompt"]
    assert "Markdown compatible con GFM" in system_prompt
    assert "cada fila de una tabla en una línea independiente" in system_prompt
    assert "cada elemento de una lista en una línea independiente" in system_prompt
    conversation_manager = agent_class.call_args.kwargs["conversation_manager"]
    assert isinstance(conversation_manager, SlidingWindowConversationManager)
    assert conversation_manager.window_size == 12
    assert conversation_manager.per_turn is True
