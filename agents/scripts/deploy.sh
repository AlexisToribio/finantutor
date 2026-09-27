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

for command in terraform aws agentcore uv python3; do
  command -v "$command" >/dev/null || { echo "$command is required" >&2; exit 1; }
done
"$AGENTS_ROOT/scripts/package.sh"
finantutor_ensure_state_bucket "$ENV" "$REGION"
finantutor_init_terraform agents "$ENV" "$REGION"

INGEST_TF="$FINANTUTOR_ROOT/ingest/terraform/environments/$ENV"
VECTOR_BUCKET="$(terraform -chdir="$INGEST_TF" output -raw vector_bucket_name)"
VECTOR_INDEX="$(terraform -chdir="$INGEST_TF" output -raw vector_index_name)"
VECTOR_INDEX_ARN="$(terraform -chdir="$INGEST_TF" output -raw vector_index_arn)"
EMBEDDING_MODEL_ID="$(terraform -chdir="$INGEST_TF" output -raw embedding_model_id)"
[[ -n "$VECTOR_BUCKET" && -n "$VECTOR_INDEX" && -n "$VECTOR_INDEX_ARN" ]] || {
  echo "Deploy ingest first: ingest/scripts/deploy.sh $ENV" >&2
  exit 1
}
MODEL_ID="${TUTOR_MODEL_ID:-global.anthropic.claude-sonnet-4-5-20250929-v1:0}"

echo "==> Applying AgentCore support resources ($ENV)"
terraform -chdir="$TF_DIR" apply -input=false -auto-approve \
  -var="aws_region=$REGION" -var="prefix=finantutor-$ENV" \
  -var="vector_bucket_name=$VECTOR_BUCKET" -var="vector_index_name=$VECTOR_INDEX" \
  -var="vector_index_arn=$VECTOR_INDEX_ARN" \
  -var="embedding_model_id=$EMBEDDING_MODEL_ID" -var="model_id=$MODEL_ID"

ROLE_ARN="$(finantutor_output agents "$ENV" execution_role_arn)"
MEMORY_ID="$(finantutor_output agents "$ENV" memory_id)"
echo "==> Configuring AgentCore direct code deployment ($ENV)"
(cd "$AGENTS_ROOT" && agentcore configure --entrypoint main.py --name "$AGENT_NAME" \
  --execution-role "$ROLE_ARN" --deployment-type direct_code_deploy \
  --runtime PYTHON_3_12 --requirements-file requirements.txt --region "$REGION" \
  --disable-memory --non-interactive)
python3 "$YAML_TOOL" "$YAML" --relativize

if [[ -f "$YAML" ]]; then
  RUNTIME_ID="$(python3 "$YAML_TOOL" "$YAML" --get agent_id --agent "$AGENT_NAME")"
  if [[ -n "$RUNTIME_ID" && "$RUNTIME_ID" != "null" ]]; then
    if RUNTIME_GET_ERROR="$(aws bedrock-agentcore-control get-agent-runtime \
      --agent-runtime-id "$RUNTIME_ID" --region "$REGION" 2>&1)"; then
      :
    elif [[ "$RUNTIME_GET_ERROR" == *ResourceNotFoundException* ]]; then
      python3 "$YAML_TOOL" "$YAML" --clear-runtime --agent "$AGENT_NAME"
    else
      echo "$RUNTIME_GET_ERROR" >&2
      exit 1
    fi
  fi
fi

(cd "$AGENTS_ROOT" && agentcore deploy --auto-update-on-conflict \
  --env "AWS_REGION=$REGION" --env PYTHONPATH=src --env PYTHONUNBUFFERED=1 \
  --env "TUTOR_MODEL_ID=$MODEL_ID" --env "VECTOR_BUCKET=$VECTOR_BUCKET" \
  --env "VECTOR_INDEX=$VECTOR_INDEX" --env "EMBEDDING_MODEL_ID=$EMBEDDING_MODEL_ID" \
  --env "AGENTCORE_MEMORY_ID=$MEMORY_ID")
RUNTIME_ARN="$(python3 "$YAML_TOOL" "$YAML" --get agent_arn --agent "$AGENT_NAME")"
[[ -n "$RUNTIME_ARN" && "$RUNTIME_ARN" != "null" ]] || {
  echo "AgentCore CLI did not record an ARN for $AGENT_NAME." >&2
  exit 1
}
echo "Done. AgentCore runtime: $RUNTIME_ARN"
