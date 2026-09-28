import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / "src"))

from application.dispatch import dispatch
from domain.ports.chat_assistant import ChatAssistant


class FakeChat(ChatAssistant):
    def __init__(self) -> None:
        self.calls: list[tuple[str, str, str]] = []

    def reply(self, session_id: str, message: str, actor_id: str) -> dict:
        self.calls.append((session_id, message, actor_id))
        return {"reply": f"echo:{message}", "session_id": session_id}


def test_prompt_goes_to_chat():
    chat = FakeChat()
    result = dispatch(
        {"prompt": "¿Cómo se interpreta el VAN?"},
        chat=chat,
        session_id="sess-9",
    )
    assert result["reply"] == "echo:¿Cómo se interpreta el VAN?"
    assert chat.calls == [("sess-9", "¿Cómo se interpreta el VAN?", "finantutor-student")]


def test_actor_id_from_payload():
    chat = FakeChat()
    result = dispatch(
        {"prompt": "hola", "actor_id": "user:abc"},
        chat=chat,
        session_id="s",
    )
    assert result["reply"] == "echo:hola"
    assert chat.calls == [("s", "hola", "user:abc")]


def test_message_alias_goes_to_chat():
    result = dispatch(
        {"message": "hola"},
        chat=FakeChat(),
        session_id="s",
    )
    assert result["reply"] == "echo:hola"


def test_structured_json_is_not_a_shortcut():
    chat = FakeChat()
    result = dispatch(
        {"grade": 3, "subject": "matematicas", "topic": "fracciones"},
        chat=chat,
        session_id="s1",
    )
    assert "error" in result
    assert chat.calls == []


def test_empty_payload_returns_example():
    result = dispatch({}, chat=FakeChat(), session_id="s")
    assert "error" in result
    assert "prompt" in result["example"]
