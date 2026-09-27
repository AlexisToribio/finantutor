#!/usr/bin/env bash
# Empty a versioned S3 bucket so terraform destroy can delete it.
set -euo pipefail

bucket="${1:?Usage: empty-s3-bucket.sh <bucket>}"

if ! aws s3api head-bucket --bucket "$bucket" >/dev/null 2>&1; then
  echo "Bucket $bucket not found, skipping"
  exit 0
fi

echo "==> Emptying s3://$bucket"
aws s3 rm "s3://${bucket}" --recursive >/dev/null || true

python3 - "$bucket" <<'PY'
import json
import subprocess
import sys

bucket = sys.argv[1]


def versions():
    out = subprocess.check_output(
        ["aws", "s3api", "list-object-versions", "--bucket", bucket, "--output", "json"],
        text=True,
    )
    data = json.loads(out or "{}")
    objs = []
    for key in ("Versions", "DeleteMarkers"):
        for obj in data.get(key) or []:
            objs.append({"Key": obj["Key"], "VersionId": obj["VersionId"]})
    return objs


while True:
    objs = versions()
    if not objs:
        break
    for i in range(0, len(objs), 1000):
        payload = json.dumps({"Objects": objs[i : i + 1000], "Quiet": True})
        subprocess.check_call(
            ["aws", "s3api", "delete-objects", "--bucket", bucket, "--delete", payload]
        )
PY
