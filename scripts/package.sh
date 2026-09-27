#!/usr/bin/env bash
set -euo pipefail
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"
pnpm --filter backend build
uv export --project agents --frozen --no-dev --no-emit-project --no-hashes --output-file agents/requirements.txt >/dev/null
uv export --project ingest --frozen --no-dev --no-emit-project --no-hashes --output-file ingest/requirements.txt >/dev/null
python3 scripts/package.py
