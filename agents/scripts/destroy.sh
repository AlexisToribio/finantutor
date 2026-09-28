#!/usr/bin/env bash
set -euo pipefail

ENV="${1:-dev}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TF_DIR="$ROOT/terraform/environments/$ENV"
YAML="$ROOT/.bedrock_agentcore.yaml"
YAML_TOOL="$ROOT/scripts/agentcore-yaml.py"

if [[ "$ENV" != "dev" && "$ENV" != "prod" ]]; then
  echo "Usage: $0 [dev|prod]" >&2
  exit 1
fi

if ! command -v terraform >/dev/null || ! command -v aws >/dev/null; then
  echo "terraform and aws CLI are required" >&2
  exit 1
fi

yaml_value() {
  python3 "$YAML_TOOL" "$YAML" --get "$1" 2>/dev/null || true
}

delete_runtime() {
  local agent_id="$1"
  local region="$2"
  if [[ -z "$agent_id" || "$agent_id" == "null" ]]; then
    return 0
  fi

  echo "==> Deleting AgentCore runtime $agent_id"
  # Do not use `agentcore destroy`: it detaches policies and deletes the Terraform execution role.
  aws bedrock-agentcore-control delete-agent-runtime \
    --agent-runtime-id "$agent_id" \
    --region "$region" || true

  local i
  for i in $(seq 1 36); do
    if ! aws bedrock-agentcore-control get-agent-runtime \
      --agent-runtime-id "$agent_id" \
      --region "$region" >/dev/null 2>&1; then
      echo "Runtime gone"
      return 0
    fi
    sleep 5
  done
  echo "Warning: runtime $agent_id still present after wait" >&2
}

delete_cli_memories() {
  local region="$1"
  local ids
  ids="$(
    aws bedrock-agentcore-control list-memories --region "$region" --output json \
      | python3 -c '
import json, sys
data = json.loads(sys.stdin.read() or "{}")
for m in data.get("memories") or []:
    mid = m.get("id") or ""
    if mid.startswith("finantutor_mem") or mid.startswith("finantutor_Agent_mem"):
        print(mid)
'
  )"
  local id
  for id in $ids; do
    [[ -z "$id" ]] && continue
    echo "==> Deleting leftover CLI memory $id"
    aws bedrock-agentcore-control delete-memory \
      --memory-id "$id" \
      --region "$region" || true
  done
}

echo "==> Destroying agents ($ENV)"
terraform -chdir="$TF_DIR" init -input=false -reconfigure

REGION="$(terraform -chdir="$TF_DIR" output -raw aws_region 2>/dev/null || true)"
if [[ -z "$REGION" || "$REGION" == "null" ]]; then
  REGION="$(yaml_value region)"
fi
REGION="${REGION:-us-east-1}"

AGENT_ID="$(yaml_value agent_id)"
delete_runtime "$AGENT_ID" "$REGION"
delete_cli_memories "$REGION"
python3 "$YAML_TOOL" "$YAML" --clear-runtime

echo "==> terraform destroy agents"
terraform -chdir="$TF_DIR" destroy -input=false -auto-approve -var-file=terraform.tfvars

echo "Done. Tutor runtime and AgentCore resources destroyed."
