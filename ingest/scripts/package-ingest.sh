#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIST="$ROOT/dist/ingest"
ZIP="$ROOT/dist/ingest.zip"

rm -rf "$DIST" "$ZIP"
mkdir -p "$DIST"

python3 -m pip install \
  --disable-pip-version-check \
  --quiet \
  --target "$DIST" \
  "pypdf>=5.0.0" \
  "boto3>=1.40.0"

copy_tree() {
  local src="$1"
  local dest="$2"
  mkdir -p "$dest"
  (cd "$src" && find . -type f -name '*.py' ! -path '*/__pycache__/*' -print0 |
    xargs -0 -I{} cp --parents "{}" "$dest")
}

copy_tree "$ROOT/src/domain" "$DIST/domain"
copy_tree "$ROOT/src/application" "$DIST/application"
copy_tree "$ROOT/src/infrastructure" "$DIST/infrastructure"
cp "$ROOT/src/ingest.py" "$DIST/ingest.py"

find "$DIST" -type d -name '__pycache__' -prune -exec rm -rf {} +

(
  cd "$DIST"
  zip -qr "$ZIP" .
)

echo "Wrote $ZIP ($(wc -c < "$ZIP") bytes)"
