#!/usr/bin/env python3
"""Empty the environment's old ECR repository before Terraform removes it."""

import argparse

import boto3


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("repository_uri")
    parser.add_argument("environment", choices=("dev", "prod"))
    parser.add_argument("--region", default="us-east-1")
    args = parser.parse_args()
    registry, repository = args.repository_uri.split("/", 1)
    account_id = boto3.client("sts").get_caller_identity()["Account"]
    if registry != f"{account_id}.dkr.ecr.{args.region}.amazonaws.com":
        raise RuntimeError("Legacy ECR repository belongs to another AWS account.")
    if repository != f"finantutor-{args.environment}-tutor":
        raise RuntimeError("Legacy ECR repository name does not match the environment.")
    ecr = boto3.client("ecr", region_name=args.region)
    images = [
        {
            "image": {"imageDigest": image["imageDigest"]},
            "index": image.get("imageManifestMediaType", "").endswith(
                ("image.index.v1+json", "manifest.list.v2+json")
            ),
        }
        for page in ecr.get_paginator("describe_images").paginate(
            repositoryName=repository
        )
        for image in page.get("imageDetails", [])
    ]
    pending = sorted(images, key=lambda item: not item["index"])
    while pending:
        response = ecr.batch_delete_image(
            repositoryName=repository,
            imageIds=[item["image"] for item in pending[:100]],
        )
        if response.get("failures"):
            raise RuntimeError(f"ECR image cleanup failed: {response['failures'][:3]}")
        del pending[:100]
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
