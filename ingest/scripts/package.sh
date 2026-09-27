#!/usr/bin/env bash
set -euo pipefail

INGEST_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST="$INGEST_ROOT/dist/ingest"
ZIP="$INGEST_ROOT/dist/ingest.zip"

rm -rf "$DIST" "$ZIP"
mkdir -p "$DIST"
uv pip install --python-version 3.12 --python-platform x86_64-manylinux2014 \
  --target "$DIST" -r "$INGEST_ROOT/requirements.txt"
cp -R "$INGEST_ROOT/src/finantutor_ingest" "$DIST/finantutor_ingest"
find "$DIST" -type d -name __pycache__ -prune -exec rm -rf {} +
mkdir -p "$(dirname "$ZIP")"
(cd "$DIST" && zip -qr "$ZIP" .)
echo "Created ingest/dist/ingest.zip"
