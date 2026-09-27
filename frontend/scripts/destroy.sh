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
finantutor_init_terraform frontend "$ENV" "$REGION"
BUCKET="$(finantutor_output frontend "$ENV" bucket_name)"
finantutor_empty_bucket "$BUCKET" "$REGION"

FUNCTION_URL="$(finantutor_output backend "$ENV" function_url)"
FUNCTION_NAME="$(finantutor_output backend "$ENV" function_name)"
echo "==> Destroying frontend ($ENV; CloudFront can take several minutes)"
terraform -chdir="$TF_DIR" destroy -input=false -auto-approve \
  -var="aws_region=$REGION" -var="prefix=finantutor-$ENV" \
  -var="function_url=$FUNCTION_URL" -var="function_name=$FUNCTION_NAME"
