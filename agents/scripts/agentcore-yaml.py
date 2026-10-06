#!/usr/bin/env python3
"""Read or clear runtime ids in .bedrock_agentcore.yaml without PyYAML."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path


def yaml_value(path: Path, key: str) -> str:
    for line in path.read_text().splitlines():
        stripped = line.lstrip()
        if stripped.startswith(f"{key}:"):
            return stripped.split(":", 1)[1].strip().strip("\"'")
    return ""


def _set_key(text: str, key: str, value: str) -> str:
    lines = []
    for line in text.splitlines(keepends=True):
        stripped = line.lstrip()
        if stripped.startswith(f"{key}:"):
            indent = line[: len(line) - len(stripped)]
            nl = "\n" if line.endswith("\n") else ""
            line = f"{indent}{key}: {value}{nl}"
        lines.append(line)
    return "".join(lines)


def clear_runtime_ids(path: Path) -> None:
    text = path.read_text()
    for key in ("agent_id", "agent_arn"):
        text = _set_key(text, key, "null")
    path.write_text(text)


def set_lifecycle_defaults(path: Path) -> None:
    """Declare the lifecycle values currently used by AgentCore defaults."""
    text = path.read_text()
    text = _set_key(text, "idle_runtime_session_timeout", "900")
    text = _set_key(text, "max_lifetime", "28800")
    path.write_text(text)


def _relative_to_yaml_dir(raw: str, root: Path) -> str:
    if not raw or raw == "null":
        return raw
    candidate = Path(raw)
    resolved = (
        candidate.resolve() if candidate.is_absolute() else (root / candidate).resolve()
    )
    try:
        rel = resolved.relative_to(root)
    except ValueError:
        return candidate.name or raw
    posix = rel.as_posix()
    return "." if posix in ("", ".") else posix


def relativize_paths(path: Path) -> None:
    """Rewrite entrypoint/source_path so they are relative to the YAML directory."""
    root = path.parent.resolve()
    text = path.read_text()
    entry = _relative_to_yaml_dir(yaml_value(path, "entrypoint"), root)
    source = _relative_to_yaml_dir(yaml_value(path, "source_path"), root)
    if entry:
        text = _set_key(text, "entrypoint", entry)
    if source:
        text = _set_key(text, "source_path", source)
    path.write_text(text)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("yaml")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--get")
    group.add_argument("--clear-runtime", action="store_true")
    group.add_argument("--relativize", action="store_true")
    group.add_argument("--set-lifecycle-defaults", action="store_true")
    group.add_argument("--write-tfvars")
    args = parser.parse_args()
    path = Path(args.yaml)
    if not path.is_file():
        if args.write_tfvars:
            print("No .bedrock_agentcore.yaml; deploy agents first", file=sys.stderr)
            return 1
        return 0
    if args.clear_runtime:
        clear_runtime_ids(path)
        return 0
    if args.relativize:
        relativize_paths(path)
        return 0
    if args.set_lifecycle_defaults:
        set_lifecycle_defaults(path)
        return 0
    if args.write_tfvars:
        arn = yaml_value(path, "agent_arn")
        if not arn or arn == "null":
            print("No agent_arn in YAML; deploy agents first", file=sys.stderr)
            return 1
        dest = Path(args.write_tfvars)
        dest.write_text(f'agent_runtime_arn = "{arn}"\n')
        print(f"Wrote {dest} ({arn})")
        return 0
    print(yaml_value(path, args.get), end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
