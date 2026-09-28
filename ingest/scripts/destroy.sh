#!/usr/bin/env bash
set -euo pipefail

ENV="${1:-dev}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TF_DIR="$ROOT/terraform/environments/$ENV"
EMPTY="$ROOT/../scripts/empty-s3-bucket.sh"

if [[ "$ENV" != "dev" && "$ENV" != "prod" ]]; then
  echo "Usage: $0 [dev|prod]" >&2
  exit 1
fi

if ! command -v terraform >/dev/null || ! command -v aws >/dev/null; then
  echo "terraform and aws CLI are required" >&2
  exit 1
fi

echo "==> Destroying ingest ($ENV)"
terraform -chdir="$TF_DIR" init -input=false -reconfigure

if BUCKET="$(terraform -chdir="$TF_DIR" output -raw books_bucket_name 2>/dev/null)" && [[ -n "$BUCKET" ]]; then
  "$EMPTY" "$BUCKET"
fi

echo "==> terraform destroy ingest"
terraform -chdir="$TF_DIR" destroy -input=false -auto-approve -var-file=terraform.tfvars

echo "Done. Ingest $ENV destroyed."
