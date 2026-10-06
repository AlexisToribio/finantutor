from __future__ import annotations

import contextvars
import threading
import time
from typing import Any

from strands import Agent
from strands.types.agent import Limits

from infrastructure.logger import logger

TUTOR_LIMITS: Limits = {
    "turns": 8,
    "output_tokens": 6500,
    "total_tokens": 48000,
}
TUTOR_TIMEOUT_SECONDS = 105

_REQUEST_DEADLINE: contextvars.ContextVar[float | None] = contextvars.ContextVar(
    "agent_request_deadline", default=None
)
_REQUEST_CANCEL: contextvars.ContextVar[threading.Event | None] = (
    contextvars.ContextVar("agent_request_cancel", default=None)
)


class AgentTimeoutError(TimeoutError):
    """Raised when an agent invocation exceeds its wall-clock budget."""


def invoke_agent(
    agent: Agent,
    prompt: Any,
    *,
    role: str,
    limits: Limits,
    timeout_seconds: int,
) -> Any:
    messages_before = len(agent.messages)
    now = time.monotonic()
    deadline = _REQUEST_DEADLINE.get()
    is_root_invocation = deadline is None
    if deadline is None:
        deadline = now + timeout_seconds
        deadline_token = _REQUEST_DEADLINE.set(deadline)
        request_cancel = threading.Event()
        cancel_token = _REQUEST_CANCEL.set(request_cancel)
        request_timer = threading.Timer(timeout_seconds, request_cancel.set)
        request_timer.daemon = True
        request_timer.start()
    else:
        deadline_token = cancel_token = None
        request_cancel = _REQUEST_CANCEL.get()
        request_timer = None

    remaining_seconds = deadline - now
    stage_timeout = min(timeout_seconds, remaining_seconds)
    if stage_timeout <= 0 or request_cancel is None:
        if (
            is_root_invocation
            and request_timer is not None
            and deadline_token is not None
            and cancel_token is not None
        ):
            request_timer.cancel()
            _REQUEST_DEADLINE.reset(deadline_token)
            _REQUEST_CANCEL.reset(cancel_token)
        raise AgentTimeoutError(f"{role} exceeded its request time budget")

    stage_timed_out = threading.Event()

    def cancel_stage() -> None:
        stage_timed_out.set()
        agent.cancel()

    stage_timer = threading.Timer(stage_timeout, cancel_stage)
    stage_timer.daemon = True
    stage_timer.start()
    try:
        result = agent(
            prompt,
            limits=limits,
            cancel_signal=request_cancel,
        )
    finally:
        stage_timer.cancel()
        if (
            is_root_invocation
            and request_timer is not None
            and deadline_token is not None
            and cancel_token is not None
        ):
            request_timer.cancel()
            _REQUEST_DEADLINE.reset(deadline_token)
            _REQUEST_CANCEL.reset(cancel_token)

    if (
        request_cancel.is_set()
        or stage_timed_out.is_set()
        or result.stop_reason == "cancelled"
    ):
        logger.warning(
            "agent.invocation.timed_out",
            role=role,
            timeout_seconds=timeout_seconds,
        )
        raise AgentTimeoutError(f"{role} exceeded its {timeout_seconds}s timeout")

    metric_fields = _invocation_metric_fields(agent, result, messages_before)
    if result.stop_reason in {
        "limit_turns",
        "limit_total_tokens",
        "limit_output_tokens",
    }:
        logger.warning(
            "agent.invocation.budget_reached",
            role=role,
            stop_reason=result.stop_reason,
            limits=limits,
            **metric_fields,
        )
    else:
        logger.info(
            "agent.invocation.completed",
            role=role,
            stop_reason=result.stop_reason,
            **metric_fields,
        )
    return result


def _invocation_metric_fields(
    agent: Agent,
    result: Any,
    messages_before: int,
) -> dict[str, int | None]:
    metrics = getattr(result, "metrics", None)
    invocation = getattr(metrics, "latest_agent_invocation", None)
    usage = getattr(invocation, "usage", None) or {}
    cycles = getattr(invocation, "cycles", None) or ()
    return {
        "input_tokens": usage.get("inputTokens") or 0,
        "output_tokens": usage.get("outputTokens") or 0,
        "total_tokens": usage.get("totalTokens") or 0,
        "cycles": len(cycles),
        "context_size": getattr(result, "context_size", None),
        "messages_before": messages_before,
        "messages_after": len(agent.messages),
    }
