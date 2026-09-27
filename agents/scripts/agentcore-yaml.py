#!/usr/bin/env python3
"""Read and update AgentCore CLI configuration without a YAML dependency."""

import argparse
from pathlib import Path


def agent_lines(text: str, name: str) -> list[str]:
    lines = text.splitlines(keepends=True)
    start = next(
        (i for i, line in enumerate(lines) if line.rstrip() == f"  {name}:"), None
    )
    if start is None:
        return []
    end = next(
        (
            i
            for i in range(start + 1, len(lines))
            if lines[i].startswith("  ") and not lines[i].startswith("    ")
        ),
        len(lines),
    )
    return lines[start:end]


def value(lines: list[str], key: str) -> str:
    for line in lines:
        stripped = line.lstrip()
        if stripped.startswith(f"{key}:"):
            return stripped.split(":", 1)[1].strip().strip("\"'")
    return ""


def set_agent_value(text: str, name: str, key: str, new_value: str) -> str:
    lines = text.splitlines(keepends=True)
    start = next(
        (i for i, line in enumerate(lines) if line.rstrip() == f"  {name}:"), None
    )
    if start is None:
        return text
    end = next(
        (
            i
            for i in range(start + 1, len(lines))
            if lines[i].startswith("  ") and not lines[i].startswith("    ")
        ),
        len(lines),
    )
    for i in range(start + 1, end):
        stripped = lines[i].lstrip()
        if stripped.startswith(f"{key}:"):
            indent = lines[i][: len(lines[i]) - len(stripped)]
            newline = "\n" if lines[i].endswith("\n") else ""
            lines[i] = f"{indent}{key}: {new_value}{newline}"
    return "".join(lines)


def relativize(path: Path) -> None:
    text = path.read_text()
    root = path.parent.resolve()
    for key in ("entrypoint", "source_path"):
        raw = value(text.splitlines(), key)
        if not raw or raw == "null":
            continue
        candidate = Path(raw)
        resolved = candidate.resolve() if candidate.is_absolute() else (root / candidate).resolve()
        try:
            raw = resolved.relative_to(root).as_posix() or "."
        except ValueError:
            raw = candidate.name or raw
        lines = text.splitlines(keepends=True)
        for index, line in enumerate(lines):
            stripped = line.lstrip()
            if stripped.startswith(f"{key}:"):
                indent = line[: len(line) - len(stripped)]
                newline = "\n" if line.endswith("\n") else ""
                lines[index] = f"{indent}{key}: {raw}{newline}"
                break
        text = "".join(lines)
    path.write_text(text)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("yaml", type=Path)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--get")
    group.add_argument("--clear-runtime", action="store_true")
    group.add_argument("--relativize", action="store_true")
    parser.add_argument("--agent")
    args = parser.parse_args()
    if not args.yaml.is_file():
        return 0
    text = args.yaml.read_text()
    if args.relativize:
        relativize(args.yaml)
    elif args.clear_runtime:
        if args.agent:
            for key in ("agent_id", "agent_arn"):
                text = set_agent_value(text, args.agent, key, "null")
            args.yaml.write_text(text)
    else:
        lines = agent_lines(text, args.agent) if args.agent else text.splitlines()
        print(value(lines, args.get), end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
