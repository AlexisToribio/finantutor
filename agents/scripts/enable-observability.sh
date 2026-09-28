#!/usr/bin/env bash
# Account-level CloudWatch Transaction Search + runtime log group.
# Idempotent. Transaction Search is once per account/region (dev and prod share it).
set -euo pipefail

ENV="${1:-dev}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TF_DIR="$ROOT/terraform/environments/$ENV"

if [[ "$ENV" != "dev" && "$ENV" != "prod" ]]; then
  echo "Usage: $0 [dev|prod]" >&2
  exit 1
fi

if ! command -v aws >/dev/null; then
  echo "aws CLI is required" >&2
  exit 1
fi

REGION="${AWS_REGION:-}"
if [[ -z "$REGION" && -d "$TF_DIR" ]]; then
  REGION="$(terraform -chdir="$TF_DIR" output -raw aws_region 2>/dev/null || true)"
fi
REGION="${REGION:-us-east-1}"
ACCOUNT="$(aws sts get-caller-identity --query Account --output text --region "$REGION")"

echo "==> Transaction Search ($REGION)"
POLICY="$(ACCOUNT="$ACCOUNT" REGION="$REGION" python3 - <<'PY'
import json
import os

account = os.environ["ACCOUNT"]
region = os.environ["REGION"]
print(json.dumps({
    "Version": "2012-10-17",
    "Statement": [{
        "Sid": "TransactionSearchXRayAccess",
        "Effect": "Allow",
        "Principal": {"Service": "xray.amazonaws.com"},
        "Action": "logs:PutLogEvents",
        "Resource": [
            f"arn:aws:logs:{region}:{account}:log-group:aws/spans:*",
            f"arn:aws:logs:{region}:{account}:log-group:/aws/application-signals/data:*",
            f"arn:aws:logs:{region}:{account}:log-group:/aws/bedrock-agentcore/runtimes/*",
        ],
        "Condition": {
            "ArnLike": {"aws:SourceArn": f"arn:aws:xray:{region}:{account}:*"},
            "StringEquals": {"aws:SourceAccount": account},
        },
    }],
}))
PY
)"
aws logs put-resource-policy \
  --region "$REGION" \
  --policy-name TransactionSearchXRayAccess \
  --policy-document "$POLICY" >/dev/null

DEST="$(aws xray get-trace-segment-destination --region "$REGION" --query Destination --output text 2>/dev/null || true)"
if [[ "$DEST" != "CloudWatchLogs" ]]; then
  aws xray update-trace-segment-destination \
    --region "$REGION" \
    --destination CloudWatchLogs >/dev/null
fi

CURRENT_INDEX="$(aws xray get-indexing-rules --region "$REGION" \
  --query 'IndexingRules[?Name==`Default`].Rule.Probabilistic.DesiredSamplingPercentage | [0]' \
  --output text 2>/dev/null || true)"
if [[ "$CURRENT_INDEX" != "1.0" && "$CURRENT_INDEX" != "1" ]]; then
  aws xray update-indexing-rule \
    --region "$REGION" \
    --name Default \
    --rule '{"Probabilistic":{"DesiredSamplingPercentage":1}}' >/dev/null
fi

YAML="$ROOT/.bedrock_agentcore.yaml"
YAML_TOOL="$ROOT/scripts/agentcore-yaml.py"
AGENT_ID=""
if [[ -f "$YAML" ]]; then
  AGENT_ID="$(python3 "$YAML_TOOL" "$YAML" --get agent_id 2>/dev/null || true)"
fi
if [[ -n "$AGENT_ID" && "$AGENT_ID" != "null" ]]; then
  RUNTIME_LOG_GROUP="/aws/bedrock-agentcore/runtimes/${AGENT_ID}-DEFAULT"
  aws logs create-log-group --log-group-name "$RUNTIME_LOG_GROUP" --region "$REGION" >/dev/null 2>&1 || true
  aws logs put-retention-policy \
    --log-group-name "$RUNTIME_LOG_GROUP" \
    --retention-in-days 7 \
    --region "$REGION"
  echo "Runtime logs: $RUNTIME_LOG_GROUP"
fi

echo "GenAI Observability: CloudWatch → Application Signals → Generative AI"
echo "Transaction Search: CloudWatch → Transaction Search (aws/spans)"
