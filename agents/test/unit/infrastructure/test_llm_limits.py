from __future__ import annotations

import threading
from dataclasses import dataclass
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from infrastructure.llm.limits import AgentTimeoutError, TUTOR_LIMITS, invoke_agent


@dataclass
class _AgentResult:
    stop_reason: str = "end_turn"


def _result_with_metrics(stop_reason: str = "end_turn") -> SimpleNamespace:
    invocation = SimpleNamespace(
        usage={"inputTokens": 1200, "outputTokens": 300, "totalTokens": 1500},
        cycles=[object(), object()],
    )
    metrics = SimpleNamespace(latest_agent_invocation=invocation)
    return SimpleNamespace(
        stop_reason=stop_reason,
        metrics=metrics,
        context_size=1100,
    )


def test_tutor_limits_allow_search_and_synthesis() -> None:
    assert TUTOR_LIMITS == {
        "turns": 8,
        "output_tokens": 6500,
        "total_tokens": 48000,
    }


def test_invoke_agent_passes_limits_and_cancel_signal() -> None:
    agent = MagicMock(return_value=_AgentResult())
    limits = {"turns": 2, "output_tokens": 100, "total_tokens": 200}

    result = invoke_agent(
        agent,
        "hola",
        role="test_agent",
        limits=limits,
        timeout_seconds=10,
    )

    assert result.stop_reason == "end_turn"
    _, kwargs = agent.call_args
    assert kwargs["limits"] == limits
    assert isinstance(kwargs["cancel_signal"], threading.Event)


def test_invoke_agent_translates_cancelled_result_to_timeout() -> None:
    agent = MagicMock(return_value=_AgentResult(stop_reason="cancelled"))

    with pytest.raises(AgentTimeoutError, match="test_agent exceeded"):
        invoke_agent(
            agent,
            "hola",
            role="test_agent",
            limits={"turns": 1},
            timeout_seconds=10,
        )


def test_invoke_agent_cleans_request_context_after_failure() -> None:
    failing_agent = MagicMock(side_effect=RuntimeError("model failed"))

    with pytest.raises(RuntimeError, match="model failed"):
        invoke_agent(
            failing_agent,
            "hola",
            role="failing_agent",
            limits={"turns": 1},
            timeout_seconds=10,
        )

    succeeding_agent = MagicMock(return_value=_AgentResult())
    invoke_agent(
        succeeding_agent,
        "hola de nuevo",
        role="succeeding_agent",
        limits={"turns": 1},
        timeout_seconds=10,
    )

    cancel_signal = succeeding_agent.call_args.kwargs["cancel_signal"]
    assert not cancel_signal.is_set()


@pytest.mark.parametrize(
    ("stop_reason", "log_method", "event"),
    [
        ("end_turn", "info", "agent.invocation.completed"),
        (
            "limit_total_tokens",
            "warning",
            "agent.invocation.budget_reached",
        ),
    ],
)
def test_invoke_agent_logs_usage_and_history_metrics(
    stop_reason: str,
    log_method: str,
    event: str,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    agent = MagicMock(return_value=_result_with_metrics(stop_reason))
    agent.messages = [{"role": "user"}, {"role": "assistant"}]
    log = MagicMock()
    monkeypatch.setattr("infrastructure.llm.limits.logger", log)

    invoke_agent(
        agent,
        "hola",
        role="tutor",
        limits={"turns": 8, "total_tokens": 48000},
        timeout_seconds=10,
    )

    getattr(log, log_method).assert_called_once_with(
        event,
        role="tutor",
        **(
            {
                "stop_reason": stop_reason,
                "limits": {"turns": 8, "total_tokens": 48000},
            }
            if stop_reason.startswith("limit_")
            else {"stop_reason": stop_reason}
        ),
        input_tokens=1200,
        output_tokens=300,
        total_tokens=1500,
        cycles=2,
        context_size=1100,
        messages_before=2,
        messages_after=2,
    )
