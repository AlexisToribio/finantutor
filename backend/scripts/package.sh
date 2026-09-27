#!/usr/bin/env bash
set -euo pipefail

BACKEND_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MONOREPO_ROOT="$(cd "$BACKEND_ROOT/.." && pwd)"
pnpm --dir "$MONOREPO_ROOT" --filter backend build
mkdir -p "$BACKEND_ROOT/dist"
rm -f "$BACKEND_ROOT/dist/backend.zip"
(cd "$BACKEND_ROOT/dist" && zip -q backend.zip index.js)
