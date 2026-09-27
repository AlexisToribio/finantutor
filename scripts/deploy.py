#!/usr/bin/env python3
"""Interactive Terraform applies in dependency order. No implicit destroy or credentials."""

import argparse
import json
import os
import subprocess
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("environment", choices=("dev", "prod"))
parser.add_argument("--state-bucket", required=True)
parser.add_argument("--region", default="us-east-1")
args = parser.parse_args()


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
    if input(f"Apply the reviewed {component} plan? Type yes: ").strip() != "yes":
        raise SystemExit("Deployment stopped before apply.")
    run(tf(component, "apply", "deployment.tfplan"))


run(["bash", "scripts/package.sh"])
for component in ("backend", "ingest", "agents", "frontend"):
    variables(component)
    run(
        tf(
            component,
            "init",
            "-reconfigure",
            f"-backend-config=bucket={args.state_bucket}",
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
