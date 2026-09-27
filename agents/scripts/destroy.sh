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
if [[ -f "$TF_DIR/deployment.auto.tfvars.json" ]]; then
  python3 -c 'import json,sys; p=sys.argv[1]; d=json.load(open(p)); d.pop("container_image_uri",None); open(p,"w").write(json.dumps(d,indent=2)+"\n")' \
    "$TF_DIR/deployment.auto.tfvars.json"
fi

delete_runtime() {
  local runtime_id="$1"
  [[ -n "$runtime_id" && "$runtime_id" != "null" ]] || return 0
  local response arn name account_id
  if ! response="$(aws bedrock-agentcore-control get-agent-runtime --agent-runtime-id "$runtime_id" \
    --region "$REGION" --output json 2>&1)"; then
    [[ "$response" == *ResourceNotFoundException* ]] && return 0
    echo "$response" >&2
    exit 1
  fi
  arn="$(python3 -c 'import json,sys; print(json.loads(sys.argv[1]).get("agentRuntimeArn", ""))' "$response")"
  name="$(python3 -c 'import json,sys; print(json.loads(sys.argv[1]).get("agentRuntimeName", ""))' "$response")"
  account_id="$(aws sts get-caller-identity --query Account --output text)"
  [[ "$name" == "$AGENT_NAME" && "$arn" == "arn:aws:bedrock-agentcore:$REGION:$account_id:runtime/$AGENT_NAME"* ]] || {
    echo "Runtime $runtime_id does not belong to $ENV in the active AWS account/region." >&2
    exit 1
  }
  echo "==> Deleting AgentCore runtime $runtime_id"
  aws bedrock-agentcore-control delete-agent-runtime --agent-runtime-id "$runtime_id" --region "$REGION"
  for _ in {1..36}; do
    sleep 5
    if response="$(aws bedrock-agentcore-control get-agent-runtime --agent-runtime-id "$runtime_id" \
      --region "$REGION" 2>&1)"; then
      continue
    elif [[ "$response" == *ResourceNotFoundException* ]]; then
      return 0
    else
      echo "$response" >&2
      exit 1
    fi
  done
  echo "AgentCore runtime $runtime_id did not disappear after 180 seconds." >&2
  exit 1
}

RUNTIME_ID=""
if [[ -f "$YAML" ]]; then
  RUNTIME_ID="$(python3 "$YAML_TOOL" "$YAML" --get agent_id --agent "$AGENT_NAME")"
fi
if [[ -z "$RUNTIME_ID" || "$RUNTIME_ID" == "null" ]]; then
  LEGACY_ARN="$(finantutor_output agents "$ENV" runtime_arn)"
  [[ -z "$LEGACY_ARN" || "$LEGACY_ARN" == "null" ]] || RUNTIME_ID="${LEGACY_ARN##*/}"
fi
delete_runtime "$RUNTIME_ID"
if [[ -f "$YAML" ]]; then python3 "$YAML_TOOL" "$YAML" --clear-runtime --agent "$AGENT_NAME"; fi

LEGACY_ECR_URL="$(finantutor_output agents "$ENV" ecr_url)"
if [[ -n "$LEGACY_ECR_URL" && "$LEGACY_ECR_URL" != "null" ]]; then
  "${PYTHON:-python3}" "$AGENTS_ROOT/scripts/cleanup-legacy-ecr.py" \
    "$LEGACY_ECR_URL" "$ENV" --region "$REGION"
fi
KB_ID="$(finantutor_output ingest "$ENV" knowledge_base_id)"
KB_ARN="$(finantutor_output ingest "$ENV" knowledge_base_arn)"
echo "==> Destroying AgentCore support resources ($ENV)"
terraform -chdir="$TF_DIR" destroy -input=false -auto-approve \
  -var="aws_region=$REGION" -var="prefix=finantutor-$ENV" \
  -var="knowledge_base_id=$KB_ID" -var="knowledge_base_arn=$KB_ARN"
