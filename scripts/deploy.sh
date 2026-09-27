#!/usr/bin/env bash
# Deploy order: backend bootstrap → ingest → agents → backend → frontend → ingest CORS.
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
export PYTHON="$FINANTUTOR_ROOT/agents/.venv/bin/python"
[[ -x "$PYTHON" ]] || { echo "Missing agents/.venv/bin/python; install project dependencies first." >&2; exit 1; }
finantutor_create_state_bucket "$ENV" "$REGION"
export FINANTUTOR_STATE_READY=1

echo "==> Deploying Finantutor $ENV in $REGION"
"$FINANTUTOR_ROOT/backend/scripts/deploy.sh" "$ENV" --bootstrap --region "$REGION"
"$FINANTUTOR_ROOT/ingest/scripts/deploy.sh" "$ENV" --region "$REGION"
"$FINANTUTOR_ROOT/agents/scripts/deploy.sh" "$ENV" --region "$REGION"
"$FINANTUTOR_ROOT/backend/scripts/deploy.sh" "$ENV" --region "$REGION"
"$FINANTUTOR_ROOT/frontend/scripts/deploy.sh" "$ENV" --region "$REGION"
"$FINANTUTOR_ROOT/ingest/scripts/deploy.sh" "$ENV" --region "$REGION"

POOL_ID="$(terraform -chdir="$FINANTUTOR_ROOT/backend/terraform/environments/$ENV" \
  output -raw cognito_pool_id)"
echo "Done. Finantutor: https://$(terraform -chdir="$FINANTUTOR_ROOT/frontend/terraform/environments/$ENV" output -raw domain)"
echo "Create your Cognito user in pool: $POOL_ID"
