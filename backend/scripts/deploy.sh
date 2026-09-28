#!/usr/bin/env bash
set -euo pipefail

ENV="${1:-dev}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TF_DIR="$ROOT/terraform/environments/$ENV"
DIST="$ROOT/dist"

if [[ "$ENV" != "dev" && "$ENV" != "prod" ]]; then
  echo "Usage: $0 [dev|prod]" >&2
  exit 1
fi

if ! command -v terraform >/dev/null; then
  echo "terraform is required" >&2
  exit 1
fi

if ! command -v pnpm >/dev/null; then
  echo "pnpm is required" >&2
  exit 1
fi

echo "==> Bundling Lambda"
mkdir -p "$DIST"
pnpm --dir "$ROOT" exec esbuild src/lambda.ts \
  --bundle \
  --platform=node \
  --target=node24 \
  --format=cjs \
  --outfile="$DIST/index.js"
rm -f "$DIST/lambda.zip"
(
  cd "$DIST"
  zip -q lambda.zip index.js
)

AGENTS_YAML="$ROOT/../agents/.bedrock_agentcore.yaml"
YAML_TOOL="$ROOT/../agents/scripts/agentcore-yaml.py"
python3 "$YAML_TOOL" "$AGENTS_YAML" --write-tfvars "$TF_DIR/variables.auto.tfvars"

echo "==> Applying Terraform ($ENV)"
terraform -chdir="$TF_DIR" init -input=false -reconfigure
terraform -chdir="$TF_DIR" apply -input=false -auto-approve -var-file=terraform.tfvars

FUNCTION_NAME="$(terraform -chdir="$TF_DIR" output -raw function_name)"
FUNCTION_URL="$(terraform -chdir="$TF_DIR" output -raw function_url)"

echo "Done. Function URL (IAM, use CloudFront): $FUNCTION_URL"
echo "Function: $FUNCTION_NAME"
