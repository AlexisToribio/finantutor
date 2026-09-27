#!/usr/bin/env python3
"""Deploy Finantutor in dependency order and provision its Terraform state bucket."""

import argparse
import json
import os
import subprocess
from datetime import datetime, timezone
from pathlib import Path

import boto3
from botocore.exceptions import ClientError

ROOT = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("environment", choices=("dev", "prod"))
parser.add_argument("--region", default="us-east-1")
parser.add_argument("--yes", action="store_true", help="Apply plans without prompting")
args = parser.parse_args()
aws = boto3.Session(region_name=args.region)


def ensure_state_bucket() -> tuple[str, str]:
    account_id = aws.client("sts").get_caller_identity()["Account"]
    bucket = f"finantutor-terraform-state-{args.environment}-{args.region}-{account_id}"
    s3 = aws.client("s3", region_name=args.region)
    created = False
    try:
        s3.head_bucket(Bucket=bucket, ExpectedBucketOwner=account_id)
    except ClientError as error:
        status = error.response.get("ResponseMetadata", {}).get("HTTPStatusCode")
        if status not in (403, 404) and error.response["Error"]["Code"] not in (
            "403",
            "404",
            "NoSuchBucket",
        ):
            raise
        try:
            request = {"Bucket": bucket}
            if args.region != "us-east-1":
                request["CreateBucketConfiguration"] = {
                    "LocationConstraint": args.region
                }
            s3.create_bucket(**request)
        except ClientError as create_error:
            code = create_error.response["Error"]["Code"]
            if code != "BucketAlreadyOwnedByYou":
                if code == "BucketAlreadyExists":
                    raise RuntimeError(
                        f"S3 bucket name {bucket} is already owned by another AWS account."
                    ) from create_error
                raise
        created = True
    if created:
        print(f"Created Terraform state bucket: s3://{bucket}", flush=True)
    else:
        print(f"Using Terraform state bucket: s3://{bucket}", flush=True)
    s3.put_bucket_versioning(
        Bucket=bucket, VersioningConfiguration={"Status": "Enabled"}
    )
    s3.put_public_access_block(
        Bucket=bucket,
        PublicAccessBlockConfiguration={
            "BlockPublicAcls": True,
            "IgnorePublicAcls": True,
            "BlockPublicPolicy": True,
            "RestrictPublicBuckets": True,
        },
    )
    s3.put_bucket_encryption(
        Bucket=bucket,
        ServerSideEncryptionConfiguration={
            "Rules": [
                {"ApplyServerSideEncryptionByDefault": {"SSEAlgorithm": "AES256"}}
            ]
        },
    )
    s3.put_bucket_policy(
        Bucket=bucket,
        Policy=json.dumps(
            {
                "Version": "2012-10-17",
                "Statement": [
                    {
                        "Sid": "DenyInsecureTransport",
                        "Effect": "Deny",
                        "Principal": "*",
                        "Action": "s3:*",
                        "Resource": [
                            f"arn:aws:s3:::{bucket}",
                            f"arn:aws:s3:::{bucket}/*",
                        ],
                        "Condition": {"Bool": {"aws:SecureTransport": "false"}},
                    }
                ],
            }
        ),
    )
    return account_id, bucket


def run(command, **kwargs):
    return subprocess.run(command, cwd=ROOT, check=True, **kwargs)


def directory(component):
    return ROOT / component / "terraform/environments" / args.environment


def tf(component, *command):
    return ["terraform", f"-chdir={directory(component)}", *command]


def outputs(component):
    result = run(tf(component, "output", "-json"), capture_output=True, text=True)
    return {key: value["value"] for key, value in json.loads(result.stdout).items()}


def variables(component, **values):
    path = directory(component) / "deployment.auto.tfvars.json"
    current = json.loads(path.read_text()) if path.exists() else {}
    current.update(
        aws_region=args.region, prefix=f"finantutor-{args.environment}", **values
    )
    path.write_text(json.dumps(current, indent=2) + "\n")


def apply(component):
    run(tf(component, "plan", "-out=deployment.tfplan"))
    # Terraform's prompt is absent for a saved plan, so require an explicit review here.
    if (
        not args.yes
        and input(f"Apply the reviewed {component} plan? Type yes: ").strip() != "yes"
    ):
        raise SystemExit("Deployment stopped before apply.")
    run(tf(component, "apply", "deployment.tfplan"))


account_id, state_bucket = ensure_state_bucket()
print(
    f"Deploying {args.environment} to AWS account {account_id} in {args.region}.",
    flush=True,
)
run(["bash", "scripts/package.sh"])
for component in ("backend", "ingest", "agents", "frontend"):
    variables(component)
    run(
        tf(
            component,
            "init",
            "-reconfigure",
            f"-backend-config=bucket={state_bucket}",
            f"-backend-config=key=finantutor/{args.environment}/{component}.tfstate",
            f"-backend-config=region={args.region}",
            "-backend-config=encrypt=true",
            "-backend-config=use_lockfile=true",
        )
    )
# Keep persisted runtime inputs on subsequent runs. Never bootstrap with null over an existing resource.
backend = outputs("backend")
if not backend.get("table_name"):
    apply("backend")
    backend = outputs("backend")
variables("ingest", table_name=backend["table_name"], table_arn=backend["table_arn"])
apply("ingest")
knowledge = outputs("ingest")
variables(
    "agents",
    knowledge_base_id=knowledge["knowledge_base_id"],
    knowledge_base_arn=knowledge["knowledge_base_arn"],
)
agent = outputs("agents")
if not agent.get("ecr_url"):
    apply("agents")
    agent = outputs("agents")
repository = agent["ecr_url"]
registry = repository.split("/")[0]
password = run(
    ["aws", "ecr", "get-login-password", "--region", args.region], capture_output=True
).stdout
run(
    ["docker", "login", "--username", "AWS", "--password-stdin", registry],
    input=password,
)
image = repository + ":" + datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S%f")
run(
    [
        "docker",
        "buildx",
        "build",
        "--platform",
        "linux/arm64",
        "--provenance=false",
        "--push",
        "-t",
        image,
        "agents",
    ]
)
variables("agents", container_image_uri=image)
apply("agents")
agent = outputs("agents")
variables(
    "backend",
    agent_runtime_arn=agent["runtime_arn"],
    materials_bucket=knowledge["materials_bucket"],
)
apply("backend")
backend = outputs("backend")
variables(
    "frontend",
    function_url=backend["function_url"],
    function_name=backend["function_name"],
)
apply("frontend")
ui = outputs("frontend")
origin = "https://" + ui["domain"]
variables("ingest", allowed_origins=[origin])
apply("ingest")
env = dict(
    os.environ,
    VITE_AUTH_MODE="cognito",
    VITE_API_URL="",
    VITE_AWS_REGION=args.region,
    VITE_COGNITO_USER_POOL_ID=backend["cognito_pool_id"],
    VITE_COGNITO_CLIENT_ID=backend["cognito_client_id"],
)
run(["pnpm", "--filter", "frontend", "build"], env=env)
run(
    [
        "aws",
        "s3",
        "sync",
        "frontend/dist",
        "s3://" + ui["bucket_name"],
        "--delete",
        "--region",
        args.region,
    ]
)
run(
    [
        "aws",
        "cloudfront",
        "create-invalidation",
        "--distribution-id",
        ui["distribution_id"],
        "--paths",
        "/*",
    ]
)
print("Finantutor:", origin)
print("Create your Cognito user in pool:", backend["cognito_pool_id"])
print("Terraform state bucket:", state_bucket)
