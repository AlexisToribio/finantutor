#!/usr/bin/env bash
set -euo pipefail

ENV="${1:-dev}"
shift || true
REGION="us-east-1"
BOOTSTRAP=0
while (($#)); do
  case "$1" in
    --region) [[ -n "${2:-}" ]] || { echo "--region requires a value" >&2; exit 2; }; REGION="$2"; shift 2 ;;
    --bootstrap) BOOTSTRAP=1; shift ;;
    *) echo "Usage: $0 [dev|prod] [--region REGION]" >&2; exit 2 ;;
  esac
done
[[ "$ENV" == "dev" || "$ENV" == "prod" ]] || { echo "Usage: $0 [dev|prod] [--region REGION]" >&2; exit 2; }

BACKEND_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FINANTUTOR_ROOT="$(cd "$BACKEND_ROOT/.." && pwd)"
source "$FINANTUTOR_ROOT/scripts/common.sh"
TF_DIR="$BACKEND_ROOT/terraform/environments/$ENV"
YAML_TOOL="$FINANTUTOR_ROOT/agents/scripts/agentcore-yaml.py"
AGENT_NAME="finantutor_${ENV}_tutor"

command -v terraform >/dev/null || { echo "terraform is required" >&2; exit 1; }
command -v pnpm >/dev/null || { echo "pnpm is required" >&2; exit 1; }
finantutor_ensure_state_bucket "$ENV" "$REGION"
finantutor_init_terraform backend "$ENV" "$REGION"
if ((BOOTSTRAP)) && [[ -n "$(finantutor_output backend "$ENV" table_name)" ]]; then
  echo "Backend foundation already exists; skipping bootstrap."
  exit 0
fi
"$BACKEND_ROOT/scripts/package.sh"

VARS=("-var=aws_region=$REGION" "-var=prefix=finantutor-$ENV")
RUNTIME_ARN=""
if [[ -f "$FINANTUTOR_ROOT/agents/.bedrock_agentcore.yaml" ]]; then
  RUNTIME_ARN="$(python3 "$YAML_TOOL" "$FINANTUTOR_ROOT/agents/.bedrock_agentcore.yaml" \
    --get agent_arn --agent "$AGENT_NAME")"
fi
MATERIALS_BUCKET="$(finantutor_output ingest "$ENV" materials_bucket)"
if ((BOOTSTRAP)); then
  RUNTIME_ARN=""
  MATERIALS_BUCKET=""
fi
[[ -z "$RUNTIME_ARN" || "$RUNTIME_ARN" == "null" ]] || VARS+=("-var=agent_runtime_arn=$RUNTIME_ARN")
[[ -z "$MATERIALS_BUCKET" || "$MATERIALS_BUCKET" == "null" ]] || VARS+=("-var=materials_bucket=$MATERIALS_BUCKET")
printf '{"aws_region":"%s","prefix":"finantutor-%s","agent_runtime_arn":%s,"materials_bucket":%s}\n' \
  "$REGION" "$ENV" \
  "$(if [[ -n "$RUNTIME_ARN" && "$RUNTIME_ARN" != "null" ]]; then printf '"%s"' "$RUNTIME_ARN"; else printf 'null'; fi)" \
  "$(if [[ -n "$MATERIALS_BUCKET" && "$MATERIALS_BUCKET" != "null" ]]; then printf '"%s"' "$MATERIALS_BUCKET"; else printf 'null'; fi)" \
  > "$TF_DIR/deployment.auto.tfvars.json"

if ((BOOTSTRAP)); then
  VARS=("-var=aws_region=$REGION" "-var=prefix=finantutor-$ENV")
fi

echo "==> Applying backend ($ENV)"
terraform -chdir="$TF_DIR" apply -input=false -auto-approve "${VARS[@]}"
echo "Done. Backend Lambda: $(finantutor_output backend "$ENV" function_name)"
