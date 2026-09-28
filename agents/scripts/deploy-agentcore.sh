#!/usr/bin/env bash
set -euo pipefail

ENV="${1:-dev}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TF_DIR="$ROOT/terraform/environments/$ENV"

if [[ "$ENV" != "dev" && "$ENV" != "prod" ]]; then
  echo "Usage: $0 [dev|prod]" >&2
  exit 1
fi

if ! command -v terraform >/dev/null; then
  echo "terraform is required" >&2
  exit 1
fi

if ! command -v agentcore >/dev/null; then
  echo "agentcore CLI is required (pip install bedrock-agentcore-starter-toolkit)" >&2
  exit 1
fi

INGEST_TF="$ROOT/../ingest/terraform/environments/$ENV"
if ! terraform -chdir="$INGEST_TF" output -raw vector_index_arn >/dev/null 2>&1; then
  echo "Apply ingest first: (cd ../ingest && ./scripts/deploy.sh $ENV)" >&2
  exit 1
fi

echo "==> Applying Terraform ($ENV)"
terraform -chdir="$TF_DIR" init -input=false -reconfigure
terraform -chdir="$TF_DIR" apply -input=false -auto-approve -var-file=terraform.tfvars

echo "==> Enabling AgentCore observability"
"$ROOT/scripts/enable-observability.sh" "$ENV"

ROLE_ARN="$(terraform -chdir="$TF_DIR" output -raw execution_role_arn)"
GUARDRAIL_ID="$(terraform -chdir="$TF_DIR" output -raw guardrail_id)"
GUARDRAIL_VERSION="$(terraform -chdir="$TF_DIR" output -raw guardrail_version)"
REGION="$(terraform -chdir="$TF_DIR" output -raw aws_region)"
MODEL_ID="$(terraform -chdir="$TF_DIR" output -raw model_id)"
MEMORY_ID="$(terraform -chdir="$TF_DIR" output -raw memory_id)"
VECTOR_BUCKET="$(terraform -chdir="$INGEST_TF" output -raw vector_bucket_name)"
VECTOR_INDEX="$(terraform -chdir="$INGEST_TF" output -raw vector_index_name)"

echo "==> Configuring AgentCore"
cd "$ROOT"
YAML="$ROOT/.bedrock_agentcore.yaml"
YAML_TOOL="$ROOT/scripts/agentcore-yaml.py"
# STM is Terraform (AGENTCORE_MEMORY_ID). --disable-memory stops the CLI from creating a second Memory.
agentcore configure \
  --entrypoint main.py \
  --name finantutor \
  --execution-role "$ROLE_ARN" \
  --deployment-type direct_code_deploy \
  --runtime PYTHON_3_10 \
  --requirements-file requirements.txt \
  --region "$REGION" \
  --disable-memory \
  --non-interactive

python3 "$YAML_TOOL" "$YAML" --relativize

# configure preserves a stale agent_id. If that runtime is gone, drop it so deploy creates a new one.
AGENT_ID="$(python3 "$YAML_TOOL" "$YAML" --get agent_id 2>/dev/null || true)"
if [[ -n "$AGENT_ID" && "$AGENT_ID" != "null" ]]; then
  if ! aws bedrock-agentcore-control get-agent-runtime \
    --agent-runtime-id "$AGENT_ID" \
    --region "$REGION" >/dev/null 2>&1; then
    echo "==> Runtime $AGENT_ID no longer exists; creating a new one"
    python3 "$YAML_TOOL" "$YAML" --clear-runtime
  fi
fi

echo "==> Deploying AgentCore runtime"
agentcore deploy \
  --auto-update-on-conflict \
  --env "AWS_REGION=${REGION}" \
  --env "GUARDRAIL_ID=${GUARDRAIL_ID}" \
  --env "GUARDRAIL_VERSION=${GUARDRAIL_VERSION}" \
  --env "MODEL_ID=${MODEL_ID}" \
  --env "VECTOR_BUCKET=${VECTOR_BUCKET}" \
  --env "VECTOR_INDEX=${VECTOR_INDEX}" \
  --env "AGENTCORE_MEMORY_ID=${MEMORY_ID}"

python3 "$YAML_TOOL" "$YAML" --relativize
BACKEND_TFVARS="$ROOT/../backend/terraform/environments/$ENV/variables.auto.tfvars"
python3 "$YAML_TOOL" "$YAML" --write-tfvars "$BACKEND_TFVARS"

"$ROOT/scripts/enable-observability.sh" "$ENV"

echo "Done. Chat:"
echo "  agentcore invoke '{\"prompt\":\"¿Cómo se interpreta el VAN de un proyecto?\"}' --session-id demo1"
