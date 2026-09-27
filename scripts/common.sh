#!/usr/bin/env bash

PYTHON="${PYTHON:-$FINANTUTOR_ROOT/agents/.venv/bin/python}"
if [[ ! -x "$PYTHON" ]]; then PYTHON="$(command -v python3)"; fi

finantutor_init_terraform() {
  local component="$1"
  local environment="$2"
  local region="$3"
  local directory="$FINANTUTOR_ROOT/$component/terraform/environments/$environment"
  local bucket="finantutor-terraform-state-$environment"

  terraform -chdir="$directory" init -input=false -reconfigure \
    -backend-config="bucket=$bucket" \
    -backend-config="key=finantutor/$environment/$component.tfstate" \
    -backend-config="region=$region" \
    -backend-config="encrypt=true" \
    -backend-config="use_lockfile=true"
}

finantutor_create_state_bucket() {
  local environment="$1"
  local region="$2"
  local bucket="finantutor-terraform-state-$environment"
  local account_id
  account_id="$(aws sts get-caller-identity --query Account --output text)"

  if aws s3api head-bucket --bucket "$bucket" --expected-bucket-owner "$account_id" \
    --region "$region" >/dev/null 2>&1; then
    echo "Using Terraform state bucket: s3://$bucket"
  else
    echo "Creating Terraform state bucket: s3://$bucket"
    if [[ "$region" == "us-east-1" ]]; then
      if ! aws s3api create-bucket --bucket "$bucket" --region "$region" >/dev/null; then
        aws s3api head-bucket --bucket "$bucket" --expected-bucket-owner "$account_id" \
          --region "$region" >/dev/null 2>&1 || {
          echo "Could not create state bucket $bucket; it may belong to another AWS account." >&2
          return 1
        }
      fi
    else
      if ! aws s3api create-bucket --bucket "$bucket" --region "$region" \
        --create-bucket-configuration "LocationConstraint=$region" >/dev/null; then
        aws s3api head-bucket --bucket "$bucket" --expected-bucket-owner "$account_id" \
          --region "$region" >/dev/null 2>&1 || {
          echo "Could not create state bucket $bucket; it may belong to another AWS account." >&2
          return 1
        }
      fi
    fi
  fi

  aws s3api put-bucket-versioning --bucket "$bucket" --region "$region" \
    --versioning-configuration Status=Enabled
  aws s3api put-public-access-block --bucket "$bucket" --region "$region" \
    --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
  aws s3api put-bucket-encryption --bucket "$bucket" --region "$region" \
    --server-side-encryption-configuration \
    '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
  aws s3api put-bucket-policy --bucket "$bucket" --region "$region" \
    --policy "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Sid\":\"DenyInsecureTransport\",\"Effect\":\"Deny\",\"Principal\":\"*\",\"Action\":\"s3:*\",\"Resource\":[\"arn:aws:s3:::$bucket\",\"arn:aws:s3:::$bucket/*\"],\"Condition\":{\"Bool\":{\"aws:SecureTransport\":\"false\"}}}]}"
}

finantutor_ensure_state_bucket() {
  local environment="$1"
  local region="$2"
  if [[ "${FINANTUTOR_STATE_READY:-0}" != "1" ]]; then
    finantutor_create_state_bucket "$environment" "$region"
  fi
}

finantutor_output() {
  local component="$1"
  local environment="$2"
  local name="$3"
  local outputs
  local value
  if ! outputs="$(terraform -chdir="$FINANTUTOR_ROOT/$component/terraform/environments/$environment" \
    output -json 2>/dev/null)"; then
    return 0
  fi
  value="$(python3 -c 'import json,sys; print(json.loads(sys.argv[1]).get(sys.argv[2], {}).get("value") or "", end="")' \
    "$outputs" "$name")"
  printf '%s' "$value"
}

finantutor_empty_bucket() {
  local bucket="$1"
  local region="${2:-us-east-1}"
  [[ -n "$bucket" ]] || return 0
  "$PYTHON" "$FINANTUTOR_ROOT/scripts/empty-versioned-bucket.py" "$bucket" --region "$region"
}
