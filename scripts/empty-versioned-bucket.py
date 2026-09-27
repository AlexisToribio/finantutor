#!/usr/bin/env python3
"""Delete every version and delete marker from a versioned S3 bucket."""

import argparse

import boto3


def empty_bucket(bucket: str, region: str) -> None:
    s3 = boto3.client("s3", region_name=region)
    paginator = s3.get_paginator("list_object_versions")
    pending = []
    for page in paginator.paginate(Bucket=bucket):
        pending.extend(
            {"Key": item["Key"], "VersionId": item["VersionId"]}
            for item in page.get("Versions", []) + page.get("DeleteMarkers", [])
        )
        while len(pending) >= 1000:
            _delete(s3, bucket, pending[:1000])
            del pending[:1000]
    if pending:
        _delete(s3, bucket, pending)


def _delete(s3, bucket: str, objects: list[dict]) -> None:
    response = s3.delete_objects(
        Bucket=bucket, Delete={"Objects": objects, "Quiet": True}
    )
    if response.get("Errors"):
        raise RuntimeError(f"S3 could not delete all versions in {bucket}: {response['Errors'][:3]}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("bucket")
    parser.add_argument("--region", default="us-east-1")
    args = parser.parse_args()
    empty_bucket(args.bucket, args.region)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
