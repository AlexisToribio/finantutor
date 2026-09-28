from abc import ABC, abstractmethod
from typing import Any


class ChatAssistant(ABC):
    @abstractmethod
    def reply(self, session_id: str, message: str, actor_id: str) -> dict[str, Any]:
        """Continue a conversational turn and return a JSON-serializable payload."""
