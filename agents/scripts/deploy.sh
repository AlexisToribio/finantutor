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

for command in terraform aws agentcore uv; do
  command -v "$command" >/dev/null || { echo "$command is required" >&2; exit 1; }
done
"$AGENTS_ROOT/scripts/package.sh"
finantutor_ensure_state_bucket "$ENV" "$REGION"
finantutor_init_terraform agents "$ENV" "$REGION"
if [[ -f "$TF_DIR/deployment.auto.tfvars.json" ]]; then
  python3 -c 'import json,sys; p=sys.argv[1]; d=json.load(open(p)); d.pop("container_image_uri",None); open(p,"w").write(json.dumps(d,indent=2)+"\n")' \
    "$TF_DIR/deployment.auto.tfvars.json"
fi

INGEST_TF="$FINANTUTOR_ROOT/ingest/terraform/environments/$ENV"
KB_ID="$(finantutor_output ingest "$ENV" knowledge_base_id)"
KB_ARN="$(finantutor_output ingest "$ENV" knowledge_base_arn)"
[[ -n "$KB_ID" && -n "$KB_ARN" ]] || {
  echo "Deploy ingest first: ingest/scripts/deploy.sh $ENV" >&2
  exit 1
}
MODEL_ID="$(finantutor_output agents "$ENV" model_id)"
MODEL_ID="${MODEL_ID:-global.anthropic.claude-sonnet-4-5-20250929-v1:0}"
printf '{"aws_region":"%s","prefix":"finantutor-%s","knowledge_base_id":"%s","knowledge_base_arn":"%s","model_id":"%s"}\n' \
  "$REGION" "$ENV" "$KB_ID" "$KB_ARN" "$MODEL_ID" > "$TF_DIR/deployment.auto.tfvars.json"

# Retire the prior Terraform-managed container runtime and image repository on upgrade.
LEGACY_RUNTIME_ARN="$(finantutor_output agents "$ENV" runtime_arn)"
LEGACY_ECR_URL="$(finantutor_output agents "$ENV" ecr_url)"
if [[ -n "$LEGACY_RUNTIME_ARN" && "$LEGACY_RUNTIME_ARN" != "null" ]]; then
  LEGACY_RUNTIME_ID="${LEGACY_RUNTIME_ARN##*/}"
  ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
  [[ "$LEGACY_RUNTIME_ARN" == "arn:aws:bedrock-agentcore:$REGION:$ACCOUNT_ID:runtime/finantutor_${ENV}_tutor"* ]] || {
    echo "Legacy runtime ARN does not match account, region, and environment." >&2
    exit 1
  }
  if aws bedrock-agentcore-control get-agent-runtime --agent-runtime-id "$LEGACY_RUNTIME_ID" \
    --region "$REGION" >/dev/null 2>&1; then
    aws bedrock-agentcore-control delete-agent-runtime --agent-runtime-id "$LEGACY_RUNTIME_ID" \
      --region "$REGION"
    LEGACY_RUNTIME_GONE=0
    for _ in {1..36}; do
      sleep 5
      if LEGACY_GET_ERROR="$(aws bedrock-agentcore-control get-agent-runtime \
        --agent-runtime-id "$LEGACY_RUNTIME_ID" --region "$REGION" 2>&1)"; then
        continue
      elif [[ "$LEGACY_GET_ERROR" == *ResourceNotFoundException* ]]; then
        LEGACY_RUNTIME_GONE=1
        break
      else
        echo "$LEGACY_GET_ERROR" >&2
        exit 1
      fi
    done
    ((LEGACY_RUNTIME_GONE)) || { echo "Legacy runtime deletion timed out." >&2; exit 1; }
  else
    LEGACY_GET_ERROR="$(aws bedrock-agentcore-control get-agent-runtime \
      --agent-runtime-id "$LEGACY_RUNTIME_ID" --region "$REGION" 2>&1 || true)"
    [[ "$LEGACY_GET_ERROR" == *ResourceNotFoundException* ]] || {
      echo "$LEGACY_GET_ERROR" >&2
      exit 1
    }
  fi
fi
if [[ -n "$LEGACY_ECR_URL" && "$LEGACY_ECR_URL" != "null" ]]; then
  "${PYTHON:-python3}" "$AGENTS_ROOT/scripts/cleanup-legacy-ecr.py" \
    "$LEGACY_ECR_URL" "$ENV" --region "$REGION"
fi

echo "==> Applying AgentCore support resources ($ENV)"
terraform -chdir="$TF_DIR" apply -input=false -auto-approve \
  -var="aws_region=$REGION" -var="prefix=finantutor-$ENV" \
  -var="knowledge_base_id=$KB_ID" -var="knowledge_base_arn=$KB_ARN" \
  -var="model_id=$MODEL_ID"

ROLE_ARN="$(finantutor_output agents "$ENV" execution_role_arn)"
MEMORY_ID="$(finantutor_output agents "$ENV" memory_id)"
echo "==> Configuring AgentCore direct code deployment ($ENV)"
agentcore configure --entrypoint main.py --name "$AGENT_NAME" \
  --execution-role "$ROLE_ARN" --deployment-type direct_code_deploy \
  --runtime PYTHON_3_12 --requirements-file requirements.txt --region "$REGION" \
  --disable-memory --non-interactive
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

agentcore deploy --auto-update-on-conflict \
  --env "AWS_REGION=$REGION" --env PYTHONPATH=src --env PYTHONUNBUFFERED=1 \
  --env "TUTOR_MODEL_ID=$MODEL_ID" --env "KNOWLEDGE_BASE_ID=$KB_ID" \
  --env "AGENTCORE_MEMORY_ID=$MEMORY_ID"
RUNTIME_ARN="$(python3 "$YAML_TOOL" "$YAML" --get agent_arn --agent "$AGENT_NAME")"
[[ -n "$RUNTIME_ARN" && "$RUNTIME_ARN" != "null" ]] || {
  echo "AgentCore CLI did not record an ARN for $AGENT_NAME." >&2
  exit 1
}
echo "Done. AgentCore runtime: $RUNTIME_ARN"
