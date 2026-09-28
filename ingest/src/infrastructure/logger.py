from __future__ import annotations

import json
import logging
from typing import Any


class JsonLogger:
    """stdlib logging with a JSON line CloudWatch can filter."""

    def __init__(self, service: str) -> None:
        self._service = service
        self._logger = logging.getLogger(f"finantutor.{service}")

    def info(self, event: str, **fields: Any) -> None:
        self._logger.info("%s", self._line("info", event, fields))

    def warning(self, event: str, **fields: Any) -> None:
        self._logger.warning("%s", self._line("warning", event, fields))

    def error(self, event: str, **fields: Any) -> None:
        self._logger.error("%s", self._line("error", event, fields))

    def exception(self, event: str, **fields: Any) -> None:
        self._logger.exception("%s", self._line("error", event, fields))

    def _line(self, level: str, event: str, fields: dict[str, Any]) -> str:
        return json.dumps(
            {"service": self._service, "level": level, "event": event, **fields},
            ensure_ascii=False,
            default=str,
        )


logger = JsonLogger("ingest")
