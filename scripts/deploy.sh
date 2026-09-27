#!/usr/bin/env bash
# Deploy order: ingest → agents → backend → frontend.
set -euo pipefail

ENV="dev"
REGION="us-east-1"
while (($#)); do
  case "$1" in
    dev|prod) ENV="$1" ;;
    --region) [[ -n "${2:-}" ]] || { echo "--region requires a value" >&2; exit 2; }; REGION="$2"; shift ;;
    -h|--help) echo "Usage: $0 [dev|prod] [--region REGION]"; exit 0 ;;
    *) echo "Usage: $0 [dev|prod] [--region REGION]" >&2; exit 2 ;;
  esac
  shift
done

FINANTUTOR_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$FINANTUTOR_ROOT/scripts/common.sh"
for command in terraform aws pnpm uv agentcore python3 zip; do
  command -v "$command" >/dev/null || { echo "$command is required" >&2; exit 1; }
done

finantutor_create_state_bucket "$ENV" "$REGION"
export FINANTUTOR_STATE_READY=1
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
echo "==> Deploying Finantutor $ENV to AWS account $ACCOUNT_ID in $REGION"
"$FINANTUTOR_ROOT/ingest/scripts/deploy.sh" "$ENV" --region "$REGION"
"$FINANTUTOR_ROOT/agents/scripts/deploy.sh" "$ENV" --region "$REGION"
"$FINANTUTOR_ROOT/backend/scripts/deploy.sh" "$ENV" --region "$REGION"
"$FINANTUTOR_ROOT/frontend/scripts/deploy.sh" "$ENV" --region "$REGION"

POOL_ID="$(terraform -chdir="$FINANTUTOR_ROOT/backend/terraform/environments/$ENV" \
  output -raw cognito_pool_id)"
echo "Done. Finantutor: https://$(terraform -chdir="$FINANTUTOR_ROOT/frontend/terraform/environments/$ENV" output -raw domain)"
echo "Create your Cognito user (replace the email address):"
printf '%s\n' \
  "aws cognito-idp admin-create-user \\" \
  "  --user-pool-id $POOL_ID \\" \
  "  --username tu-correo@ejemplo.com \\" \
  "  --user-attributes Name=email,Value=tu-correo@ejemplo.com Name=email_verified,Value=true \\" \
  "  --region $REGION"
