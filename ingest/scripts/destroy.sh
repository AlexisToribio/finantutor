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
"$INGEST_ROOT/scripts/package.sh"
finantutor_init_terraform ingest "$ENV" "$REGION"

WORKFLOW_ARN="$(finantutor_output ingest "$ENV" workflow_arn)"
KB_ID="$(finantutor_output ingest "$ENV" knowledge_base_id)"
SOURCE_ID="$(finantutor_output ingest "$ENV" data_source_id)"
MATERIALS_BUCKET="$(finantutor_output ingest "$ENV" materials_bucket)"
CORPUS_BUCKET="$(finantutor_output ingest "$ENV" corpus_bucket)"
"${PYTHON:-python3}" "$INGEST_ROOT/scripts/drain.py" "$ENV" --region "$REGION" \
  --workflow-arn "$WORKFLOW_ARN" --knowledge-base-id "$KB_ID" --data-source-id "$SOURCE_ID"

if [[ -n "$MATERIALS_BUCKET" || -n "$CORPUS_BUCKET" ]]; then
  echo "Waiting 630 seconds for previously issued upload URLs to expire…"
  sleep 630
fi
finantutor_empty_bucket "$MATERIALS_BUCKET" "$REGION"
finantutor_empty_bucket "$CORPUS_BUCKET" "$REGION"

TABLE_NAME="$(finantutor_output backend "$ENV" table_name)"
TABLE_ARN="$(finantutor_output backend "$ENV" table_arn)"
[[ -n "$TABLE_NAME" ]] || TABLE_NAME="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("table_name", ""))' "$TF_DIR/deployment.auto.tfvars.json" 2>/dev/null || true)"
[[ -n "$TABLE_ARN" ]] || TABLE_ARN="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("table_arn", ""))' "$TF_DIR/deployment.auto.tfvars.json" 2>/dev/null || true)"
echo "==> Destroying ingest ($ENV)"
terraform -chdir="$TF_DIR" destroy -input=false -auto-approve \
  -var="aws_region=$REGION" -var="prefix=finantutor-$ENV" \
  -var="table_name=$TABLE_NAME" -var="table_arn=$TABLE_ARN"
