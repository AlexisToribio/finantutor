#!/usr/bin/env bash
set -euo pipefail

ENV="${1:-dev}"
shift || true
REGION="us-east-1"
while (($#)); do
  case "$1" in
    --region) [[ -n "${2:-}" ]] || { echo "--region requires a value" >&2; exit 2; }; REGION="$2"; shift 2 ;;
    *) echo "Usage: $0 [dev|prod] [--region REGION]" >&2; exit 2 ;;
  esac
done
[[ "$ENV" == "dev" || "$ENV" == "prod" ]] || { echo "Usage: $0 [dev|prod] [--region REGION]" >&2; exit 2; }

FRONTEND_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FINANTUTOR_ROOT="$(cd "$FRONTEND_ROOT/.." && pwd)"
source "$FINANTUTOR_ROOT/scripts/common.sh"
TF_DIR="$FRONTEND_ROOT/terraform/environments/$ENV"
command -v pnpm >/dev/null || { echo "pnpm is required" >&2; exit 1; }
command -v aws >/dev/null || { echo "aws CLI is required" >&2; exit 1; }
finantutor_ensure_state_bucket "$ENV" "$REGION"
finantutor_init_terraform frontend "$ENV" "$REGION"

FUNCTION_URL="$(finantutor_output backend "$ENV" function_url)"
FUNCTION_NAME="$(finantutor_output backend "$ENV" function_name)"
POOL_ID="$(finantutor_output backend "$ENV" cognito_pool_id)"
CLIENT_ID="$(finantutor_output backend "$ENV" cognito_client_id)"
[[ -n "$FUNCTION_URL" && -n "$FUNCTION_NAME" ]] || {
  echo "Deploy backend first: backend/scripts/deploy.sh $ENV" >&2
  exit 1
}
printf '{"aws_region":"%s","prefix":"finantutor-%s","function_url":"%s","function_name":"%s"}\n' \
  "$REGION" "$ENV" "$FUNCTION_URL" "$FUNCTION_NAME" > "$TF_DIR/deployment.auto.tfvars.json"

echo "==> Applying frontend infrastructure ($ENV)"
terraform -chdir="$TF_DIR" apply -input=false -auto-approve \
  -var="aws_region=$REGION" -var="prefix=finantutor-$ENV" \
  -var="function_url=$FUNCTION_URL" -var="function_name=$FUNCTION_NAME"

export VITE_AUTH_MODE=cognito
export VITE_API_URL=
export VITE_AWS_REGION="$REGION"
export VITE_COGNITO_USER_POOL_ID="$POOL_ID"
export VITE_COGNITO_CLIENT_ID="$CLIENT_ID"
pnpm --dir "$FINANTUTOR_ROOT" --filter frontend build

BUCKET="$(finantutor_output frontend "$ENV" bucket_name)"
DISTRIBUTION="$(finantutor_output frontend "$ENV" distribution_id)"
DOMAIN="$(finantutor_output frontend "$ENV" domain)"
aws s3 sync "$FRONTEND_ROOT/dist" "s3://$BUCKET" --delete --region "$REGION"
aws cloudfront create-invalidation --distribution-id "$DISTRIBUTION" --paths '/*' >/dev/null
echo "Done. https://$DOMAIN"
