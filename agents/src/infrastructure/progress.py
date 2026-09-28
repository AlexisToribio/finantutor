from __future__ import annotations

from contextvars import ContextVar, Token
from typing import Protocol


class Progress(Protocol):
    def report(self, step: str, text: str) -> None: ...


class NullProgress:
    def report(self, step: str, text: str) -> None:
        return None


_current: ContextVar[Progress] = ContextVar(
    "finantutor_progress",
    default=NullProgress(),
)


def report_progress(step: str, text: str) -> None:
    _current.get().report(step, text)


def bind_progress(progress: Progress) -> Token[Progress]:
    return _current.set(progress)


def reset_progress(token: Token[Progress]) -> None:
    _current.reset(token)
