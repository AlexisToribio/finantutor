#!/usr/bin/env python3
"""Stop Finantutor ingestion triggers and active Step Functions/Bedrock jobs."""

import argparse
import time

import boto3
from botocore.exceptions import ClientError


def disable_ingestion_rules(events, prefix: str) -> None:
    names = {f"{prefix}-pdf-arrived", f"{prefix}-ingest-failed"}
    existing = {
        rule["Name"]
        for page in events.get_paginator("list_rules").paginate(NamePrefix=prefix)
        for rule in page.get("Rules", [])
    }
    for name in sorted(names & existing):
        events.disable_rule(Name=name)
        print(f"Paused ingestion trigger: {name}", flush=True)


def stop_workflows(states, arn: str, deadline: float) -> None:
    paginator = states.get_paginator("list_executions")
    executions = [
        item["executionArn"]
        for page in paginator.paginate(stateMachineArn=arn, statusFilter="RUNNING")
        for item in page.get("executions", [])
    ]
    for execution_arn in executions:
        try:
            states.stop_execution(
                executionArn=execution_arn,
                error="FinantutorDestroy",
                cause="Environment teardown",
            )
        except ClientError as error:
            if error.response["Error"]["Code"] != "ExecutionNotRunning":
                raise
    while executions:
        active = [
            arn
            for arn in executions
            if states.describe_execution(executionArn=arn)["status"] == "RUNNING"
        ]
        if not active:
            return
        if time.monotonic() > deadline:
            raise TimeoutError("Ingestion workflows did not stop before the timeout.")
        time.sleep(5)
        executions = active


def stop_knowledge_jobs(bedrock, kb_id: str, source_id: str, deadline: float) -> None:
    filters = [
        {
            "attribute": "STATUS",
            "operator": "EQ",
            "values": ["STARTING", "IN_PROGRESS", "STOPPING"],
        }
    ]
    paginator = bedrock.get_paginator("list_ingestion_jobs")
    while True:
        jobs = [
            job
            for page in paginator.paginate(
                knowledgeBaseId=kb_id, dataSourceId=source_id, filters=filters
            )
            for job in page.get("ingestionJobSummaries", [])
        ]
        active = [
            job
            for job in jobs
            if job["status"] in ("STARTING", "IN_PROGRESS", "STOPPING")
        ]
        if not active:
            return
        for job in active:
            if job["status"] == "STOPPING":
                continue
            try:
                bedrock.stop_ingestion_job(
                    knowledgeBaseId=kb_id,
                    dataSourceId=source_id,
                    ingestionJobId=job["ingestionJobId"],
                )
            except ClientError as error:
                if error.response["Error"]["Code"] not in (
                    "ConflictException",
                    "ResourceNotFoundException",
                ):
                    raise
        if time.monotonic() > deadline:
            raise TimeoutError("Knowledge Base ingestion did not stop before the timeout.")
        time.sleep(10)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("environment", choices=("dev", "prod"))
    parser.add_argument("--region", default="us-east-1")
    parser.add_argument("--workflow-arn", default="")
    parser.add_argument("--knowledge-base-id", default="")
    parser.add_argument("--data-source-id", default="")
    parser.add_argument("--wait-timeout", type=int, default=7200)
    args = parser.parse_args()
    prefix = f"finantutor-{args.environment}"
    deadline = time.monotonic() + args.wait_timeout
    session = boto3.Session(region_name=args.region)
    disable_ingestion_rules(session.client("events"), prefix)
    if args.workflow_arn:
        stop_workflows(session.client("stepfunctions"), args.workflow_arn, deadline)
    if args.knowledge_base_id and args.data_source_id:
        stop_knowledge_jobs(
            session.client("bedrock-agent"),
            args.knowledge_base_id,
            args.data_source_id,
            deadline,
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
