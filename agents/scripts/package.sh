#!/usr/bin/env bash
set -euo pipefail

AGENTS_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
uv export --project "$AGENTS_ROOT" --frozen --no-dev --no-emit-project --no-hashes \
  --output-file "$AGENTS_ROOT/requirements.txt" >/dev/null
