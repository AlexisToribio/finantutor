#!/usr/bin/env bash
set -euo pipefail

INGEST_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MONOREPO_ROOT="$(cd "$INGEST_ROOT/.." && pwd)"
uv export --project "$INGEST_ROOT" --frozen --no-dev --no-emit-project --no-hashes \
  --output-file "$INGEST_ROOT/requirements.txt" >/dev/null
python3 "$INGEST_ROOT/scripts/package.py"
