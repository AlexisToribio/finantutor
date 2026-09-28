#!/usr/bin/env bash
set -euo pipefail

ENV="${1:-dev}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TF_DIR="$ROOT/terraform/environments/$ENV"

if [[ "$ENV" != "dev" && "$ENV" != "prod" ]]; then
  echo "Usage: $0 [dev|prod]" >&2
  exit 1
fi

if ! command -v terraform >/dev/null; then
  echo "terraform is required" >&2
  exit 1
fi

echo "==> Packaging ingest"
chmod +x "$ROOT/scripts/package-ingest.sh"
"$ROOT/scripts/package-ingest.sh"

echo "==> Applying Terraform ($ENV)"
terraform -chdir="$TF_DIR" init -input=false -reconfigure
terraform -chdir="$TF_DIR" apply -input=false -auto-approve -var-file=terraform.tfvars

FUNCTION_NAME="$(terraform -chdir="$TF_DIR" output -raw ingest_lambda_name)"
echo "Done. Ingest Lambda: $FUNCTION_NAME"
