#!/usr/bin/env bash
set -euo pipefail

FINANTUTOR_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
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

for command in terraform aws pnpm uv python3 zip; do
  command -v "$command" >/dev/null || { echo "$command is required" >&2; exit 1; }
done
export PYTHON="$FINANTUTOR_ROOT/agents/.venv/bin/python"
[[ -x "$PYTHON" ]] || { echo "Missing agents/.venv/bin/python; install project dependencies first." >&2; exit 1; }
echo "==> Destroying Finantutor $ENV in $REGION"
"$FINANTUTOR_ROOT/frontend/scripts/destroy.sh" "$ENV" --region "$REGION"
"$FINANTUTOR_ROOT/backend/scripts/destroy.sh" "$ENV" --region "$REGION"
"$FINANTUTOR_ROOT/agents/scripts/destroy.sh" "$ENV" --region "$REGION"
"$FINANTUTOR_ROOT/ingest/scripts/destroy.sh" "$ENV" --region "$REGION"

if ((INCLUDING_STATE)); then
  BUCKET="finantutor-terraform-state-$ENV"
  ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
  "$PYTHON" "$FINANTUTOR_ROOT/scripts/empty-versioned-bucket.py" "$BUCKET" --region "$REGION"
  aws s3api delete-bucket --bucket "$BUCKET" --expected-bucket-owner "$ACCOUNT_ID" \
    --region "$REGION"
fi
echo "Done. Finantutor $ENV destroyed."
