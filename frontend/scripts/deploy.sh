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

if ! command -v pnpm >/dev/null; then
  echo "pnpm is required" >&2
  exit 1
fi

echo "==> Building SPA"
pnpm --dir "$ROOT" build

echo "==> Applying Terraform ($ENV)"
terraform -chdir="$TF_DIR" init -input=false -reconfigure
terraform -chdir="$TF_DIR" apply -input=false -auto-approve -var-file=terraform.tfvars

BUCKET="$(terraform -chdir="$TF_DIR" output -raw bucket_id)"
DISTRIBUTION="$(terraform -chdir="$TF_DIR" output -raw distribution_id)"
DOMAIN="$(terraform -chdir="$TF_DIR" output -raw domain_name)"
POOL="$(terraform -chdir="$TF_DIR" output -raw cognito_user_pool_id)"
CLIENT="$(terraform -chdir="$TF_DIR" output -raw cognito_client_id)"
REGION="$(terraform -chdir="$TF_DIR" output -raw aws_region)"

printf '%s\n' "{\"userPoolId\":\"${POOL}\",\"clientId\":\"${CLIENT}\",\"region\":\"${REGION}\"}" > "$ROOT/dist/config.json"

echo "==> Syncing $BUCKET"
aws s3 sync "$ROOT/dist" "s3://${BUCKET}" --delete --exclude "*.map"

echo "==> Invalidating CloudFront $DISTRIBUTION"
aws cloudfront create-invalidation --distribution-id "$DISTRIBUTION" --paths "/*" >/dev/null

echo "Done. https://${DOMAIN}"
