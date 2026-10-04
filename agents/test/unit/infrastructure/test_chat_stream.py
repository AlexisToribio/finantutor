import sys
import time
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / "src"))

from infrastructure.progress import report_progress
from infrastructure.runtime.chat_stream import chat_events


@pytest.mark.asyncio
async def test_first_event_is_status_before_the_agent_runs() -> None:
    started = False

    def run() -> dict:
        nonlocal started
        started = True
        return {"reply": "hola", "session_id": "s"}

    events = chat_events(run, heartbeat_seconds=60)
    first = await anext(events)
    assert first == {"type": "status", "step": "received", "text": "Recibí tu pedido."}
    assert started is False
    second = await anext(events)
    assert second["type"] == "done"
    assert second["reply"] == "hola"
    await events.aclose()


@pytest.mark.asyncio
async def test_tool_progress_is_a_status_event() -> None:
    def run() -> dict:
        report_progress("search_materials", "Buscando en el material del curso.")
        return {"reply": "listo", "session_id": "s"}

    events = [item async for item in chat_events(run, heartbeat_seconds=60)]
    assert events[1] == {
        "type": "status",
        "step": "search_materials",
        "text": "Buscando en el material del curso.",
    }
    assert events[-1]["type"] == "done"


@pytest.mark.asyncio
async def test_heartbeat_while_the_agent_is_still_working() -> None:
    def run() -> dict:
        time.sleep(0.05)
        return {"reply": "listo", "session_id": "s"}

    kinds = [item["type"] async for item in chat_events(run, heartbeat_seconds=0.01)]
    assert "heartbeat" in kinds
    assert kinds[-1] == "done"


@pytest.mark.asyncio
async def test_exception_becomes_a_generic_error_event() -> None:
    def run() -> dict:
        raise RuntimeError("AccessDenied secret")

    events = [item async for item in chat_events(run, heartbeat_seconds=60)]
    assert events[-1] == {
        "type": "error",
        "message": "El tutor no respondió. Inténtalo de nuevo.",
    }
    assert "AccessDenied" not in events[-1]["message"]
