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
[[ "$ENV" == "dev" || "$ENV" == "prod" ]] || { echo "Usage: $0 [dev|prod] [region]" >&2; exit 2; }
BACKEND_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FINANTUTOR_ROOT="$(cd "$BACKEND_ROOT/.." && pwd)"
source "$FINANTUTOR_ROOT/scripts/common.sh"
TF_DIR="$BACKEND_ROOT/terraform/environments/$ENV"
"$BACKEND_ROOT/scripts/package.sh"
finantutor_init_terraform backend "$ENV" "$REGION"
echo "==> Destroying backend ($ENV)"
terraform -chdir="$TF_DIR" destroy -input=false -auto-approve \
  -var="aws_region=$REGION" -var="prefix=finantutor-$ENV"
