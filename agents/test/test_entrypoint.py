import importlib.util
import json
from pathlib import Path
from uuid import uuid4

from starlette.testclient import TestClient


def test_agentcore_entrypoint_streams_contract_and_receives_session(monkeypatch):
    monkeypatch.setenv("KNOWLEDGE_BASE_ID", "")
    spec = importlib.util.spec_from_file_location(
        "tutor_entrypoint", Path(__file__).parents[1] / "main.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    session = "a" * 64
    captured = []

    async def tutor(payload, session_id, retriever):
        captured.append((payload, session_id))
        yield {"type": "delta", "text": "Evaluación de proyectos"}
        yield {"type": "done", "reply": "Respuesta", "citations": [], "activities": []}

    monkeypatch.setattr(module, "stream_tutor", tutor)
    payload = {
        "scope": {"owner_id": "student", "course_id": str(uuid4())},
        "mode": "explain",
        "prompt": "VAN",
    }
    with TestClient(module.app) as client:
        response = client.post(
            "/invocations",
            json=payload,
            headers={"X-Amzn-Bedrock-AgentCore-Runtime-Session-Id": session},
        )
    assert response.status_code == 200
    events = [
        json.loads(line.removeprefix("data: "))
        for line in response.text.splitlines()
        if line.startswith("data:")
    ]
    assert events[-1]["type"] == "done"
    assert events[0]["text"] == "Evaluación de proyectos"
    assert captured == [(payload, session)]
