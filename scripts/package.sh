#!/usr/bin/env bash
set -euo pipefail
FINANTUTOR_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
"$FINANTUTOR_ROOT/backend/scripts/package.sh"
"$FINANTUTOR_ROOT/ingest/scripts/package.sh"
"$FINANTUTOR_ROOT/agents/scripts/package.sh"
