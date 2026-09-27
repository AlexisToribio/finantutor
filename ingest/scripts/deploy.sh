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

INGEST_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FINANTUTOR_ROOT="$(cd "$INGEST_ROOT/.." && pwd)"
source "$FINANTUTOR_ROOT/scripts/common.sh"
TF_DIR="$INGEST_ROOT/terraform/environments/$ENV"

command -v terraform >/dev/null || { echo "terraform is required" >&2; exit 1; }
command -v uv >/dev/null || { echo "uv is required" >&2; exit 1; }
"$INGEST_ROOT/scripts/package.sh"
finantutor_ensure_state_bucket "$ENV" "$REGION"
finantutor_init_terraform ingest "$ENV" "$REGION"

TABLE_NAME="$(finantutor_output backend "$ENV" table_name)"
TABLE_ARN="$(finantutor_output backend "$ENV" table_arn)"
[[ "$TABLE_NAME" =~ ^[A-Za-z0-9_.-]{3,255}$ && \
  "$TABLE_ARN" =~ ^arn:[^:]+:dynamodb:[^:]+:[0-9]{12}:table/[A-Za-z0-9_.-]+$ ]] || {
  echo "Deploy backend first: scripts/deploy.sh $ENV (or backend/scripts/deploy.sh $ENV)." >&2
  exit 1
}
DOMAIN="$(finantutor_output frontend "$ENV" domain)"
ORIGINS='["http://127.0.0.1:5173","http://localhost:5173"]'
if [[ -n "$DOMAIN" && "$DOMAIN" != "null" ]]; then
  ORIGINS="[\"https://$DOMAIN\"]"
fi
printf '{"aws_region":"%s","prefix":"finantutor-%s","table_name":"%s","table_arn":"%s","allowed_origins":%s}\n' \
  "$REGION" "$ENV" "$TABLE_NAME" "$TABLE_ARN" "$ORIGINS" \
  > "$TF_DIR/deployment.auto.tfvars.json"

echo "==> Applying ingest ($ENV)"
terraform -chdir="$TF_DIR" apply -input=false -auto-approve \
  -var="aws_region=$REGION" -var="prefix=finantutor-$ENV" \
  -var="table_name=$TABLE_NAME" -var="table_arn=$TABLE_ARN" \
  -var="allowed_origins=$ORIGINS"
echo "Done. Knowledge Base: $(finantutor_output ingest "$ENV" knowledge_base_id)"
