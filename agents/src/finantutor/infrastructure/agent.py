import asyncio
import json
import os
import re
from collections.abc import AsyncIterator
from typing import Any

from strands import Agent, tool
from strands.models import BedrockModel

from finantutor.application.tools import TutorTools
from finantutor.application.tutor import SYSTEM_PROMPT


def build_tools(state: TutorTools) -> list[Any]:
    def guarded(call: Any) -> str:
        try:
            return json.dumps(call(), ensure_ascii=False)
        except (ValueError, KeyError, ArithmeticError) as error:
            return json.dumps({"error": str(error)}, ensure_ascii=False)

    @tool
    def search_materials(query: str, unit: str | None = None) -> str:
        """Busca evidencia del curso y devuelve source_id y localización disponible."""
        return guarded(lambda: state.search(query, unit))

    @tool
    def calculate_financial_metric(operation: str, parameters_json: str) -> str:
        """Calcula npv, irr, convert_rate o sensitivity con parámetros JSON y supuestos explícitos."""
        return guarded(lambda: state.financial_metric(operation, parameters_json))

    return [search_materials, calculate_financial_metric]


async def stream_tutor(
    payload: dict[str, Any], session_id: str, retriever: Any
) -> AsyncIterator[dict[str, Any]]:
    scope = payload["scope"]
    state = TutorTools(scope, retriever)
    session_manager = None
    memory_id = os.getenv("AGENTCORE_MEMORY_ID")
    if memory_id:
        from bedrock_agentcore.memory.integrations.strands.config import AgentCoreMemoryConfig
        from bedrock_agentcore.memory.integrations.strands.session_manager import (
            AgentCoreMemorySessionManager,
        )

        session_manager = AgentCoreMemorySessionManager(
            agentcore_memory_config=AgentCoreMemoryConfig(
                memory_id=memory_id, session_id=session_id, actor_id=f"user:{scope['owner_id']}"
            ),
            region_name=os.getenv("AWS_REGION", "us-east-1"),
        )
    # Restore bounded BFF history only when the AgentCore session manager is absent.
    history = (
        []
        if session_manager
        else [
            {"role": item["role"], "content": [{"text": item["body"]}]}
            for item in payload.get("history", [])[-20:]
            if item["role"] in ("user", "assistant")
        ]
    )
    model = BedrockModel(
        model_id=os.environ["TUTOR_MODEL_ID"],
        region_name=os.getenv("AWS_REGION", "us-east-1"),
        max_tokens=2500,
        temperature=0.2,
    )
    agent = Agent(
        model=model,
        name="TutorAgent",
        system_prompt=SYSTEM_PROMPT,
        tools=build_tools(state),
        messages=history,
        session_manager=session_manager,
        callback_handler=None,
    )
    prompt = f"Modo docente solicitado: {payload['mode']}. Curso: {scope['title']}.\nPedido del estudiante:\n{payload['prompt']}"
    yield {"type": "status", "text": "Revisando tu pregunta…"}
    queue: asyncio.Queue[dict[str, Any] | None] = asyncio.Queue()

    async def run() -> None:
        reply = ""
        try:
            async for event in agent.stream_async(prompt):
                if "data" in event:
                    text = event["data"]
                    reply += text
                    await queue.put({"type": "delta", "text": text})
                if "current_tool_use" in event:
                    await queue.put(
                        {
                            "type": "status",
                            "text": "Consultando fuentes o comprobando el procedimiento…",
                        }
                    )
            if not reply.strip():
                raise ValueError("Respuesta vacía del tutor.")
            reply = re.sub(
                r"\[\[(S\d+)\]\]",
                lambda match: (
                    match.group(0) if match[1] in state.references else "[referencia no verificada]"
                ),
                reply,
            )
            citations = [
                {"source_id": key, **{k: v for k, v in item.items() if k != "text"}}
                for key, item in state.references.items()
            ]
            await queue.put(
                {
                    "type": "done",
                    "reply": reply,
                    "citations": citations,
                }
            )
        except Exception:
            import logging

            logging.getLogger(__name__).exception("Tutor invocation failed")
            await queue.put(
                {
                    "type": "error",
                    "message": "El tutor no pudo completar la respuesta. Inténtalo de nuevo.",
                }
            )
        finally:
            await queue.put(None)

    task = asyncio.create_task(run())
    try:
        async with asyncio.timeout(105):
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=15)
                except TimeoutError:
                    yield {"type": "heartbeat"}
                    continue
                if event is None:
                    break
                yield event
    finally:
        if not task.done():
            task.cancel()
        await asyncio.gather(task, return_exceptions=True)
