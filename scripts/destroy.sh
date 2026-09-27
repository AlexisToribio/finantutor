#!/usr/bin/env bash
# Destroy order is the reverse of deployment: frontend → backend → agents → ingest.
set -euo pipefail

ENV="dev"
REGION="us-east-1"
INCLUDING_STATE=0
while (($#)); do
  case "$1" in
    dev|prod) ENV="$1" ;;
    --region) [[ -n "${2:-}" ]] || { echo "--region requires a value" >&2; exit 2; }; REGION="$2"; shift ;;
    --including-state) INCLUDING_STATE=1 ;;
    -h|--help) echo "Usage: $0 [dev|prod] [--region REGION] [--including-state]"; exit 0 ;;
    *) echo "Usage: $0 [dev|prod] [--region REGION] [--including-state]" >&2; exit 2 ;;
  esac
  shift
done

FINANTUTOR_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$FINANTUTOR_ROOT/scripts/common.sh"
for command in terraform aws pnpm uv python3 zip; do
  command -v "$command" >/dev/null || { echo "$command is required" >&2; exit 1; }
done
export FINANTUTOR_STATE_READY=1
echo "==> Destroying Finantutor $ENV in $REGION"
"$FINANTUTOR_ROOT/frontend/scripts/destroy.sh" "$ENV" --region "$REGION"
"$FINANTUTOR_ROOT/backend/scripts/destroy.sh" "$ENV" --region "$REGION"
"$FINANTUTOR_ROOT/agents/scripts/destroy.sh" "$ENV" --region "$REGION"
"$FINANTUTOR_ROOT/ingest/scripts/destroy.sh" "$ENV" --region "$REGION"

if ((INCLUDING_STATE)); then
  BUCKET="finantutor-terraform-state-$ENV"
  ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
  aws s3api head-bucket --bucket "$BUCKET" --expected-bucket-owner "$ACCOUNT_ID" --region "$REGION"
  "$FINANTUTOR_ROOT/scripts/empty-s3-bucket.sh" "$BUCKET"
  aws s3api delete-bucket --bucket "$BUCKET" --expected-bucket-owner "$ACCOUNT_ID" --region "$REGION"
fi
