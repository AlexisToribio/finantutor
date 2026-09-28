#!/usr/bin/env bash
# ingest → agents (Terraform + runtime) → backend → frontend.
# Creates the Terraform state bucket if it does not exist.
set -euo pipefail

ENV="dev"
for arg in "$@"; do
  case "$arg" in
    dev | prod) ENV="$arg" ;;
    -h | --help)
      echo "Usage: $0 [dev|prod]" >&2
      exit 0
      ;;
    *)
      echo "Usage: $0 [dev|prod]" >&2
      exit 1
      ;;
  esac
done

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STATE_BUCKET="finantutor-terraform-state-${ENV}"
STATE_REGION="us-east-1"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text 2>/dev/null || true)"

if ! command -v terraform >/dev/null || ! command -v aws >/dev/null; then
  echo "terraform and aws CLI are required" >&2
  exit 1
fi

chmod +x \
  "$ROOT/ingest/scripts/deploy.sh" \
  "$ROOT/agents/scripts/deploy-agentcore.sh" \
  "$ROOT/backend/scripts/deploy.sh" \
  "$ROOT/frontend/scripts/deploy.sh"

ensure_state_bucket() {
  if [[ -n "$ACCOUNT_ID" ]] && aws s3api head-bucket \
    --bucket "$STATE_BUCKET" --expected-bucket-owner "$ACCOUNT_ID" \
    --region "$STATE_REGION" >/dev/null 2>&1; then
    echo "==> State bucket s3://$STATE_BUCKET already exists"
    return 0
  fi
  echo "==> Creating state bucket s3://$STATE_BUCKET"
  if [[ "$STATE_REGION" == "us-east-1" ]]; then
    aws s3api create-bucket --bucket "$STATE_BUCKET" --region "$STATE_REGION"
  else
    aws s3api create-bucket --bucket "$STATE_BUCKET" --region "$STATE_REGION" \
      --create-bucket-configuration "LocationConstraint=${STATE_REGION}"
  fi
  aws s3api put-bucket-versioning --bucket "$STATE_BUCKET" \
    --versioning-configuration Status=Enabled
  aws s3api put-public-access-block --bucket "$STATE_BUCKET" \
    --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
}

echo "==> Deploy all ($ENV): ingest → agents → backend → frontend"
ensure_state_bucket
"$ROOT/ingest/scripts/deploy.sh" "$ENV"
"$ROOT/agents/scripts/deploy-agentcore.sh" "$ENV"
"$ROOT/backend/scripts/deploy.sh" "$ENV"
"$ROOT/frontend/scripts/deploy.sh" "$ENV"

echo "Done. All $ENV stacks deployed."
echo "Create a student account:"
echo "  aws cognito-idp admin-create-user \\"
echo "    --user-pool-id \"\$(terraform -chdir=$ROOT/backend/terraform/environments/$ENV output -raw cognito_user_pool_id)\" \\"
echo "    --username estudiante@upc.edu.pe \\"
echo "    --user-attributes Name=email,Value=estudiante@upc.edu.pe Name=email_verified,Value=true"
