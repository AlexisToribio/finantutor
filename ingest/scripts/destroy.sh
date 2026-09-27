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
BUCKET="$(finantutor_output ingest "$ENV" materials_bucket)"
if [[ -n "$BUCKET" && "$BUCKET" != "null" ]]; then
  "$FINANTUTOR_ROOT/scripts/empty-s3-bucket.sh" "$BUCKET"
fi

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
TABLE_NAME="finantutor-$ENV-app"
TABLE_ARN="arn:aws:dynamodb:$REGION:$ACCOUNT_ID:table/$TABLE_NAME"
echo "==> Destroying ingestion resources ($ENV)"
terraform -chdir="$TF_DIR" destroy -input=false -auto-approve \
  -var="aws_region=$REGION" -var="project_name=finantutor" \
  -var="environment=$ENV" -var="table_name=$TABLE_NAME" -var="table_arn=$TABLE_ARN"
