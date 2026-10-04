from __future__ import annotations

import asyncio
import threading
from collections.abc import AsyncIterator, Callable
from typing import Any

from infrastructure.logger import logger
from infrastructure.progress import bind_progress, reset_progress

AGENT_UNAVAILABLE = "El tutor no respondió. Inténtalo de nuevo."
HEARTBEAT_SECONDS = 15
# AgentCore runs Python 3.10, where asyncio.TimeoutError is not the builtin.
_WAIT_TIMEOUTS = (
    (TimeoutError, asyncio.TimeoutError)
    if asyncio.TimeoutError is not TimeoutError
    else (TimeoutError,)
)
_SHUTDOWN_ERRORS = _WAIT_TIMEOUTS + (asyncio.CancelledError,)


async def chat_events(
    run: Callable[[], dict[str, Any]],
    *,
    heartbeat_seconds: float = HEARTBEAT_SECONDS,
) -> AsyncIterator[dict[str, Any]]:
    yield {"type": "status", "step": "received", "text": "Recibí tu pedido."}
    loop = asyncio.get_running_loop()
    queue: asyncio.Queue[dict[str, Any] | None] = asyncio.Queue()
    stop = asyncio.Event()

    class _Sink:
        def report(self, step: str, text: str) -> None:
            delivered = threading.Event()

            def _put() -> None:
                queue.put_nowait(
                    {"type": "status", "step": step, "text": text},
                )
                delivered.set()

            loop.call_soon_threadsafe(_put)
            delivered.wait()

    async def work() -> None:
        try:

            def _call() -> dict[str, Any]:
                token = bind_progress(_Sink())
                try:
                    return run()
                finally:
                    reset_progress(token)

            result = await asyncio.to_thread(_call)
            await queue.put({"type": "done", **result})
        except Exception:
            logger.exception("runtime.stream.failed")
            await queue.put({"type": "error", "message": AGENT_UNAVAILABLE})
        finally:
            stop.set()
            await queue.put(None)

    task = asyncio.create_task(work())

    async def beats() -> None:
        while not stop.is_set():
            try:
                await asyncio.wait_for(stop.wait(), timeout=heartbeat_seconds)
            except _WAIT_TIMEOUTS:
                if not stop.is_set():
                    queue.put_nowait({"type": "heartbeat"})

    beater = asyncio.create_task(beats())
    try:
        while True:
            item = await queue.get()
            if item is None:
                break
            yield item
    finally:
        stop.set()
        await task
        try:
            await beater
        except _SHUTDOWN_ERRORS:
            pass
