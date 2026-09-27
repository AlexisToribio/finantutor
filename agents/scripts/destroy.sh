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

AGENTS_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FINANTUTOR_ROOT="$(cd "$AGENTS_ROOT/.." && pwd)"
source "$FINANTUTOR_ROOT/scripts/common.sh"
TF_DIR="$AGENTS_ROOT/terraform/environments/$ENV"
YAML="$AGENTS_ROOT/.bedrock_agentcore.yaml"
YAML_TOOL="$AGENTS_ROOT/scripts/agentcore-yaml.py"
AGENT_NAME="finantutor_${ENV}_tutor"
finantutor_init_terraform agents "$ENV" "$REGION"

if [[ -f "$YAML" ]]; then
  RUNTIME_ID="$(python3 "$YAML_TOOL" "$YAML" --get agent_id --agent "$AGENT_NAME")"
  if [[ -n "$RUNTIME_ID" && "$RUNTIME_ID" != "null" ]]; then
    echo "==> Deleting AgentCore runtime $RUNTIME_ID"
    if DELETE_ERROR="$(aws bedrock-agentcore-control delete-agent-runtime \
      --agent-runtime-id "$RUNTIME_ID" --region "$REGION" 2>&1)"; then
      :
    elif [[ "$DELETE_ERROR" != *ResourceNotFoundException* ]]; then
      echo "$DELETE_ERROR" >&2
      exit 1
    fi
    for _ in {1..36}; do
      if ! aws bedrock-agentcore-control get-agent-runtime --agent-runtime-id "$RUNTIME_ID" \
        --region "$REGION" >/dev/null 2>&1; then
        break
      fi
      sleep 5
    done
  fi
  python3 "$YAML_TOOL" "$YAML" --clear-runtime --agent "$AGENT_NAME"
fi

INGEST_TF="$FINANTUTOR_ROOT/ingest/terraform/environments/$ENV"
VECTOR_BUCKET="$(terraform -chdir="$INGEST_TF" output -raw vector_bucket_name)"
VECTOR_INDEX="$(terraform -chdir="$INGEST_TF" output -raw vector_index_name)"
VECTOR_INDEX_ARN="$(terraform -chdir="$INGEST_TF" output -raw vector_index_arn)"
EMBEDDING_MODEL_ID="$(terraform -chdir="$INGEST_TF" output -raw embedding_model_id)"
MODEL_ID="${TUTOR_MODEL_ID:-global.anthropic.claude-sonnet-4-5-20250929-v1:0}"

echo "==> Destroying AgentCore support resources ($ENV)"
terraform -chdir="$TF_DIR" destroy -input=false -auto-approve \
  -var="aws_region=$REGION" -var="prefix=finantutor-$ENV" \
  -var="vector_bucket_name=$VECTOR_BUCKET" -var="vector_index_name=$VECTOR_INDEX" \
  -var="vector_index_arn=$VECTOR_INDEX_ARN" \
  -var="embedding_model_id=$EMBEDDING_MODEL_ID" -var="model_id=$MODEL_ID"
echo "Done. Finantutor AgentCore resources destroyed."
