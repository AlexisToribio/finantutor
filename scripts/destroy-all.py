#!/usr/bin/env python3
"""Destroy one Finantutor AWS environment and its project data in dependency order."""

import argparse
import json
import subprocess
import sys
import time
from pathlib import Path

import boto3
from botocore.exceptions import ClientError

ROOT = Path(__file__).resolve().parent.parent
COMPONENTS = ("frontend", "backend", "agents", "ingest")
PRESIGNED_PUT_TTL_SECONDS = 600
WAIT_MARGIN_SECONDS = 30


def arguments():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("environment", choices=("dev", "prod"))
    parser.add_argument("--region", default="us-east-1")
    parser.add_argument(
        "--yes",
        action="store_true",
        help="Permanently remove the selected environment and its data",
    )
    parser.add_argument(
        "--wait-timeout",
        type=int,
        default=7200,
        help="Maximum seconds to drain ingestion before stopping",
    )
    parser.add_argument(
        "--including-state",
        action="store_true",
        help="Also permanently delete the Finantutor-only Terraform state bucket after destroying all stacks",
    )
    return parser.parse_args()


args = arguments()
PREFIX = f"finantutor-{args.environment}"
ACCOUNT_ID = ""
STATE_BUCKET = ""
if not args.yes:
    sys.exit(
        "This permanently deletes the environment and its documents. Re-run with --yes to proceed."
    )


def run(command: list[str], *, capture: bool = False):
    return subprocess.run(
        command,
        cwd=ROOT,
        check=True,
        text=True,
        capture_output=capture,
    )


def terraform(component: str, *command: str) -> list[str]:
    directory = ROOT / component / "terraform/environments" / args.environment
    return ["terraform", f"-chdir={directory}", *command]


def initialize(component: str) -> list[str]:
    run(
        terraform(
            component,
            "init",
            "-reconfigure",
            f"-backend-config=bucket={STATE_BUCKET}",
            f"-backend-config=key=finantutor/{args.environment}/{component}.tfstate",
            f"-backend-config=region={args.region}",
            "-backend-config=encrypt=true",
            "-backend-config=use_lockfile=true",
        )
    )
    result = subprocess.run(
        terraform(component, "state", "list"),
        cwd=ROOT,
        check=False,
        text=True,
        capture_output=True,
    )
    if result.returncode:
        if "No state file was found" in result.stderr:
            return []
        raise subprocess.CalledProcessError(
            result.returncode, result.args, result.stdout, result.stderr
        )
    return [line for line in result.stdout.splitlines() if line.strip()]


def outputs(component: str) -> dict:
    result = subprocess.run(
        terraform(component, "output", "-json"),
        cwd=ROOT,
        check=False,
        text=True,
        capture_output=True,
    )
    if result.returncode:
        raise subprocess.CalledProcessError(
            result.returncode, result.args, result.stdout, result.stderr
        )
    return {name: item.get("value") for name, item in json.loads(result.stdout).items()}


def verify_scope(
    identity: dict, state: dict[str, list[str]], values: dict[str, dict]
) -> None:
    account_id = identity["Account"]
    if account_id != ACCOUNT_ID:
        sys.exit(
            "AWS account identity changed during teardown; no resources were deleted."
        )
    if not any(state.values()):
        return
    checks = {
        "backend": {"table_name": f"{PREFIX}-app"},
        "ingest": {
            "materials_bucket": f"{PREFIX}-materials-{account_id}",
            "corpus_bucket": f"{PREFIX}-corpus-{account_id}",
        },
        "agents": {"ecr_url_suffix": f"/{PREFIX}-tutor"},
        "frontend": {"bucket_name": f"{PREFIX}-spa-{account_id}"},
    }
    for component, expected_values in checks.items():
        if not state[component]:
            continue
        actual = values[component]
        for name, expected in expected_values.items():
            if name == "ecr_url_suffix":
                valid = actual.get("ecr_url", "").endswith(expected)
            else:
                value = actual.get(name)
                valid = value == expected
            if not valid:
                sys.exit(
                    f"State scope mismatch in {component}.{name}; no resources were deleted."
                )
        for value in actual.values():
            if isinstance(value, str) and value.startswith("arn:"):
                parts = value.split(":", 5)
                if len(parts) > 4 and parts[4].isdigit() and parts[4] != account_id:
                    sys.exit(
                        f"State for {component} references AWS account {parts[4]}, expected {account_id}."
                    )


def disable_ingestion_rules(events) -> None:
    names = (f"{PREFIX}-pdf-arrived", f"{PREFIX}-ingest-failed")
    paginator = events.get_paginator("list_rules")
    existing = {
        rule["Name"]
        for page in paginator.paginate(NamePrefix=PREFIX)
        for rule in page.get("Rules", [])
    }
    for name in names:
        if name not in existing:
            continue
        events.disable_rule(Name=name)
        print(f"Paused ingestion trigger: {name}", flush=True)


def stop_workflows(states, state_machine_arn: str, deadline: float) -> None:
    paginator = states.get_paginator("list_executions")
    executions = [
        item["executionArn"]
        for page in paginator.paginate(
            stateMachineArn=state_machine_arn, statusFilter="RUNNING"
        )
        for item in page.get("executions", [])
    ]
    for arn in executions:
        try:
            states.stop_execution(
                executionArn=arn,
                error="FinantutorDestroy",
                cause="Environment teardown",
            )
        except ClientError as error:
            if error.response["Error"]["Code"] != "ExecutionNotRunning":
                raise
    while executions:
        active = []
        for arn in executions:
            status = states.describe_execution(executionArn=arn)["status"]
            if status == "RUNNING":
                active.append(arn)
        if not active:
            return
        if time.monotonic() > deadline:
            raise TimeoutError(
                "Step Functions executions did not stop before --wait-timeout."
            )
        time.sleep(5)
        executions = active


def stop_knowledge_jobs(
    bedrock, knowledge_base_id: str, data_source_id: str, deadline: float
) -> None:
    paginator = bedrock.get_paginator("list_ingestion_jobs")
    filters = [
        {
            "attribute": "STATUS",
            "operator": "EQ",
            "values": ["STARTING", "IN_PROGRESS", "STOPPING"],
        }
    ]
    while True:
        summaries = [
            job
            for page in paginator.paginate(
                knowledgeBaseId=knowledge_base_id,
                dataSourceId=data_source_id,
                filters=filters,
            )
            for job in page.get("ingestionJobSummaries", [])
        ]
        active = [
            job
            for job in summaries
            if job["status"] in ("STARTING", "IN_PROGRESS", "STOPPING")
        ]
        if not active:
            return
        for job in active:
            if job["status"] == "STOPPING":
                continue
            try:
                bedrock.stop_ingestion_job(
                    knowledgeBaseId=knowledge_base_id,
                    dataSourceId=data_source_id,
                    ingestionJobId=job["ingestionJobId"],
                )
            except ClientError as error:
                if error.response["Error"]["Code"] not in (
                    "ConflictException",
                    "ResourceNotFoundException",
                ):
                    raise
        if time.monotonic() > deadline:
            raise TimeoutError(
                "Knowledge Base ingestion jobs did not stop before --wait-timeout."
            )
        time.sleep(10)


def empty_versioned_bucket(s3, bucket: str) -> None:
    print(
        f"Deleting all objects, versions and delete markers from {bucket}…", flush=True
    )
    paginator = s3.get_paginator("list_object_versions")
    pending = []
    for page in paginator.paginate(Bucket=bucket):
        pending.extend(
            {"Key": item["Key"], "VersionId": item["VersionId"]}
            for item in page.get("Versions", []) + page.get("DeleteMarkers", [])
        )
        while len(pending) >= 1000:
            delete_objects(s3, bucket, pending[:1000])
            del pending[:1000]
    if pending:
        delete_objects(s3, bucket, pending)


def delete_objects(s3, bucket: str, objects: list[dict]) -> None:
    response = s3.delete_objects(
        Bucket=bucket, Delete={"Objects": objects, "Quiet": True}
    )
    if response.get("Errors"):
        raise RuntimeError(
            f"S3 could not delete every object version in {bucket}: {response['Errors'][:3]}"
        )


def empty_ecr(repository_uri: str, region: str) -> None:
    account_id = ACCOUNT_ID
    repository = repository_uri.split("/", 1)[1]
    if account_id != ACCOUNT_ID or repository != f"{PREFIX}-tutor":
        raise RuntimeError(
            "ECR repository is outside the selected environment and account."
        )
    ecr = boto3.client("ecr", region_name=region)
    paginator = ecr.get_paginator("describe_images")
    images = [
        {
            "image": {"imageDigest": image["imageDigest"]},
            "index": image.get("imageManifestMediaType", "").endswith(
                ("image.index.v1+json", "manifest.list.v2+json")
            ),
        }
        for page in paginator.paginate(repositoryName=repository)
        for image in page.get("imageDetails", [])
    ]
    pending = sorted(images, key=lambda item: not item["index"])
    while pending:
        response = ecr.batch_delete_image(
            repositoryName=repository,
            imageIds=[item["image"] for item in pending[:100]],
        )
        failures = response.get("failures", [])
        if not failures:
            del pending[:100]
            continue
        failed_digests = {failure["imageId"].get("imageDigest") for failure in failures}
        deletable = len(pending[:100]) - sum(
            item["image"].get("imageDigest") in failed_digests for item in pending[:100]
        )
        if deletable:
            pending = [
                item
                for item in pending
                if item["image"].get("imageDigest")
                not in {
                    success.get("imageId", {}).get("imageDigest")
                    for success in response.get("imageIds", [])
                }
            ]
            continue
        raise RuntimeError(f"ECR image deletion failed: {failures[:3]}")


def destroy(component: str) -> None:
    run(
        [
            "terraform",
            f"-chdir={ROOT / component / 'terraform/environments' / args.environment}",
            "plan",
            "-destroy",
            "-out=destroy.tfplan",
        ]
    )
    print(f"Applying reviewed destroy plan for {component}…", flush=True)
    run(
        [
            "terraform",
            f"-chdir={ROOT / component / 'terraform/environments' / args.environment}",
            "apply",
            "-auto-approve",
            "destroy.tfplan",
        ]
    )


def state_addresses(component: str) -> list[str]:
    result = run(terraform(component, "state", "list"), capture=True)
    return [line for line in result.stdout.splitlines() if line.strip()]


def main() -> None:
    global ACCOUNT_ID, STATE_BUCKET
    session = boto3.Session(region_name=args.region)
    identity = session.client("sts").get_caller_identity()
    ACCOUNT_ID = identity["Account"]
    if not ACCOUNT_ID.isdigit() or len(ACCOUNT_ID) != 12:
        sys.exit("AWS returned an invalid account ID; no infrastructure was changed.")
    STATE_BUCKET = (
        f"finantutor-terraform-state-{args.environment}-{args.region}-{ACCOUNT_ID}"
    )
    s3 = session.client("s3", region_name=args.region)
    try:
        s3.head_bucket(Bucket=STATE_BUCKET, ExpectedBucketOwner=ACCOUNT_ID)
    except ClientError as error:
        code = error.response.get("Error", {}).get("Code")
        status = error.response.get("ResponseMetadata", {}).get("HTTPStatusCode")
        if code in ("NoSuchBucket", "404") or status == 404:
            print(
                f"Terraform state bucket {STATE_BUCKET} does not exist; nothing to destroy."
            )
            return
        raise
    terraform_state: dict[str, list[str]] = {}
    stack_outputs: dict[str, dict] = {}
    for component in COMPONENTS:
        terraform_state[component] = initialize(component)
        stack_outputs[component] = (
            outputs(component) if terraform_state[component] else {}
        )
    verify_scope(identity, terraform_state, stack_outputs)
    if not any(terraform_state.values()) and not args.including_state:
        print(
            f"No Terraform resources exist for {PREFIX} in account {identity['Account']}."
        )
        return

    print(
        f"Destroying {PREFIX} in account {identity['Account']} ({args.region}). "
        f"Terraform state bucket: {STATE_BUCKET}.",
        flush=True,
    )
    deadline = time.monotonic() + args.wait_timeout
    ingest = stack_outputs["ingest"]
    if terraform_state["ingest"] and ingest.get("workflow_arn"):
        events = session.client("events")
        disable_ingestion_rules(events)
        stop_workflows(
            session.client("stepfunctions"), ingest["workflow_arn"], deadline
        )
        if ingest.get("knowledge_base_id") and ingest.get("data_source_id"):
            stop_knowledge_jobs(
                session.client("bedrock-agent"),
                ingest["knowledge_base_id"],
                ingest["data_source_id"],
                deadline,
            )

    frontend = stack_outputs["frontend"]
    if terraform_state["frontend"] and frontend.get("bucket_name"):
        empty_versioned_bucket(session.client("s3"), frontend["bucket_name"])
    if terraform_state["frontend"]:
        destroy("frontend")
    if terraform_state["backend"]:
        destroy("backend")

    ingest_buckets = [
        ingest[key] for key in ("materials_bucket", "corpus_bucket") if ingest.get(key)
    ]
    if terraform_state["ingest"] and ingest_buckets:
        print(
            f"Waiting {PRESIGNED_PUT_TTL_SECONDS + WAIT_MARGIN_SECONDS}s for already-issued upload URLs to expire…",
            flush=True,
        )
        time.sleep(PRESIGNED_PUT_TTL_SECONDS + WAIT_MARGIN_SECONDS)

    agent = stack_outputs["agents"]
    if terraform_state["agents"]:
        try:
            destroy("agents")
        except subprocess.CalledProcessError:
            addresses = state_addresses("agents")
            runtime_remains = any(
                "aws_bedrockagentcore_agent_runtime.tutor[" in address
                for address in addresses
            )
            repository_remains = any(
                "aws_ecr_repository.agent" in address for address in addresses
            )
            if runtime_remains or not repository_remains or not agent.get("ecr_url"):
                raise
            # AgentCore is already removed; ECR refuses to delete a non-empty repository.
            empty_ecr(agent["ecr_url"], args.region)
            destroy("agents")

    for bucket in ingest_buckets:
        empty_versioned_bucket(session.client("s3"), bucket)
    if terraform_state["ingest"]:
        destroy("ingest")

    if args.including_state:
        empty_versioned_bucket(s3, STATE_BUCKET)
        s3.delete_bucket(Bucket=STATE_BUCKET, ExpectedBucketOwner=ACCOUNT_ID)
        print(f"Deleted Terraform state bucket {STATE_BUCKET}.", flush=True)
    print(
        f"Destroyed {PREFIX} in AWS account {ACCOUNT_ID}.",
        flush=True,
    )


if __name__ == "__main__":
    main()
