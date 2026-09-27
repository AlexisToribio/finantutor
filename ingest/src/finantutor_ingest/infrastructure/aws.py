"""Tareas idempotentes de preparación y seguimiento, invocadas por Step Functions."""

import json
import os
from typing import Any
from urllib.parse import unquote_plus

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from finantutor_ingest.application.prepare import MAX_BYTES, prepare_pdf

CONFIG = Config(
    connect_timeout=5, read_timeout=60, retries={"mode": "standard", "total_max_attempts": 3}
)


class IngestWorker:
    def __init__(self) -> None:
        region = os.getenv("AWS_REGION", "us-east-1")
        self.s3 = boto3.client("s3", region_name=region, config=CONFIG)
        self.bedrock = boto3.client("bedrock-agent", region_name=region, config=CONFIG)
        self.states = boto3.client("stepfunctions", region_name=region, config=CONFIG)
        self.table = boto3.resource("dynamodb", region_name=region, config=CONFIG).Table(
            os.environ["APP_TABLE"]
        )
        self.raw_bucket = os.environ["MATERIALS_BUCKET"]
        self.corpus_bucket = os.environ["CORPUS_BUCKET"]

    def _material(self, key: str) -> dict[str, Any]:
        parts = key.split("/")
        if len(parts) != 5 or parts[0] != "incoming" or parts[-1] != "source.pdf":
            raise ValueError("Unexpected material key")
        _, owner, course, material_id, _ = parts
        item = self.table.get_item(
            Key={"pk": f"course#{owner}#{course}", "sk": f"material#{material_id}"},
            ConsistentRead=True,
        ).get("Item")
        if not item or item["raw_key"] != key:
            raise ValueError("Unknown material")
        return item

    def update(self, item: dict[str, Any], **values: Any) -> bool:
        request = {
            "Key": {"pk": item["pk"], "sk": item["sk"]},
            "UpdateExpression": "SET " + ", ".join(f"#a{i} = :a{i}" for i in range(len(values))),
            "ExpressionAttributeNames": {f"#a{i}": key for i, key in enumerate(values)},
            "ExpressionAttributeValues": {
                f":a{i}": value for i, value in enumerate(values.values())
            },
        }
        if values.get("status") == "failed":
            request["ConditionExpression"] = "#current_status <> :ready"
            request["ExpressionAttributeNames"]["#current_status"] = "status"
            request["ExpressionAttributeValues"][":ready"] = "ready"
        try:
            self.table.update_item(**request)
        except ClientError as error:
            if error.response["Error"]["Code"] != "ConditionalCheckFailedException":
                raise
            return False
        return True

    def prepare(self, event: dict[str, Any]) -> dict[str, Any]:
        key = unquote_plus(event["key"])
        item = self._material(key)
        if item.get("status") == "ready":
            return {"key": key, "already_ready": True}
        head = self.s3.head_object(Bucket=self.raw_bucket, Key=key)
        if head["ContentLength"] > MAX_BYTES:
            raise ValueError("PDF exceeds upload limit")
        response = self.s3.get_object(Bucket=self.raw_bucket, Key=key)
        try:
            data = response["Body"].read(MAX_BYTES + 1)
        finally:
            response["Body"].close()
        document = prepare_pdf(data, item["kind"])
        self.update(
            item,
            status="indexing",
            checksum=document.checksum,
            outline_draft=document.outline,
            page_count=len(document.pages),
        )
        prefix = f"{item['owner_id']}/{item['course_id']}/{item['id']}"
        # Immutable chunks preserve the page locator; parser output is never executable.
        for page in document.pages:
            chunks = [page.text[i : i + 3500] for i in range(0, len(page.text), 3200)]
            for index, chunk in enumerate(chunks):
                object_key = f"{prefix}/p{page.number:04d}-{index:04d}.txt"
                metadata = {
                    key: str(item[key])
                    for key in ("owner_id", "course_id", "id", "version", "title")
                }
                metadata["material_id"] = metadata.pop("id")
                metadata["page"] = page.number
                metadata["unit"] = item.get("unit", "")
                self.s3.put_object(
                    Bucket=self.corpus_bucket,
                    Key=object_key,
                    Body=chunk.encode(),
                    ContentType="text/plain; charset=utf-8",
                )
                self.s3.put_object(
                    Bucket=self.corpus_bucket,
                    Key=object_key + ".metadata.json",
                    Body=json.dumps({"metadataAttributes": metadata}).encode(),
                    ContentType="application/json",
                )
        return {"key": key, "already_ready": False, "checksum": document.checksum}

    def start(self, event: dict[str, Any]) -> dict[str, Any]:
        response = self.bedrock.start_ingestion_job(
            knowledgeBaseId=os.environ["KNOWLEDGE_BASE_ID"],
            dataSourceId=os.environ["DATA_SOURCE_ID"],
        )
        return {**event, "job_id": response["ingestionJob"]["ingestionJobId"]}

    def poll(self, event: dict[str, Any]) -> dict[str, Any]:
        job = self.bedrock.get_ingestion_job(
            knowledgeBaseId=os.environ["KNOWLEDGE_BASE_ID"],
            dataSourceId=os.environ["DATA_SOURCE_ID"],
            ingestionJobId=event["job_id"],
        )["ingestionJob"]
        return {
            **event,
            "job_status": job["status"],
            "failures": job.get("failureReasons", []),
            "documents_failed": job.get("statistics", {}).get("numberOfDocumentsFailed", 0),
        }

    def finish(self, event: dict[str, Any]) -> dict[str, Any]:
        item = self._material(event["key"])
        if item.get("status") == "ready":
            return {"status": "ready"}
        failed = event.get("failed") or event.get("job_status") != "COMPLETE"
        if not failed:
            failures = event.get("failures", [])
            failed = bool(failures) or event.get("documents_failed", 0) > 0
        updated = self.update(
            item,
            status="failed" if failed else "ready",
            error="No se pudo indexar el documento. Revisa el PDF e intenta una nueva carga."
            if failed
            else "",
        )
        return {"status": "failed" if failed and updated is not False else "ready"}

    def execution_failed(self, event: dict[str, Any]) -> dict[str, Any]:
        execution = self.states.describe_execution(executionArn=event["detail"]["executionArn"])
        item = self._material(unquote_plus(json.loads(execution["input"])["key"]))
        # A duplicate event must not overwrite a successful retry.
        try:
            self.table.update_item(
                Key={"pk": item["pk"], "sk": item["sk"]},
                UpdateExpression="SET #status = :failed, #error = :error",
                ConditionExpression="#status <> :ready",
                ExpressionAttributeNames={"#status": "status", "#error": "error"},
                ExpressionAttributeValues={
                    ":failed": "failed",
                    ":ready": "ready",
                    ":error": "La ingesta no terminó. Intenta una nueva carga.",
                },
            )
        except ClientError as error:
            if error.response["Error"]["Code"] != "ConditionalCheckFailedException":
                raise
            return {"status": "ready"}

        return {"status": "failed"}


_worker: IngestWorker | None = None


def handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    global _worker
    if _worker is None:
        _worker = IngestWorker()
    if event.get("source") == "aws.states":
        return _worker.execution_failed(event)
    action = event.get("action")
    if action not in ("prepare", "start", "poll", "finish"):
        raise ValueError("Unknown ingestion action")
    return getattr(_worker, action)(event["input"])
