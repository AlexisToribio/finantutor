#!/usr/bin/env bash
# Reverse of deploy: frontend → backend → agents (runtime + TF) → ingest.
# Does not call `agentcore destroy` (that deletes the Terraform execution role).
# Does not delete the Terraform state bucket unless you pass --including-state.
set -euo pipefail

ENV="dev"
INCLUDING_STATE=0
for arg in "$@"; do
  case "$arg" in
    dev | prod) ENV="$arg" ;;
    --including-state) INCLUDING_STATE=1 ;;
    -h | --help)
      echo "Usage: $0 [dev|prod] [--including-state]" >&2
      exit 0
      ;;
    *)
      echo "Usage: $0 [dev|prod] [--including-state]" >&2
      exit 1
      ;;
  esac
done

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EMPTY="$ROOT/scripts/empty-s3-bucket.sh"
STATE_BUCKET="finantutor-terraform-state-${ENV}"

if ! command -v terraform >/dev/null || ! command -v aws >/dev/null; then
  echo "terraform and aws CLI are required" >&2
  exit 1
fi

chmod +x \
  "$EMPTY" \
  "$ROOT/frontend/scripts/destroy.sh" \
  "$ROOT/backend/scripts/destroy.sh" \
  "$ROOT/agents/scripts/destroy.sh" \
  "$ROOT/ingest/scripts/destroy.sh"

echo "==> Destroy all ($ENV): frontend → backend → agents → ingest"
"$ROOT/frontend/scripts/destroy.sh" "$ENV"
"$ROOT/backend/scripts/destroy.sh" "$ENV"
"$ROOT/agents/scripts/destroy.sh" "$ENV"
"$ROOT/ingest/scripts/destroy.sh" "$ENV"

if [[ "$INCLUDING_STATE" -eq 1 ]]; then
  echo "==> Deleting state bucket $STATE_BUCKET"
  "$EMPTY" "$STATE_BUCKET"
  aws s3 rb "s3://${STATE_BUCKET}" || true
fi

echo "Done. All $ENV stacks destroyed."
