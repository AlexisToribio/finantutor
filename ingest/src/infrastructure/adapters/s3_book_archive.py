from pathlib import Path

import boto3

from domain.ports.book_archive import BookArchive


class S3BookArchive(BookArchive):
    def __init__(self, bucket: str, region: str) -> None:
        self._bucket = bucket
        self._s3 = boto3.client("s3", region_name=region)

    def save(self, book_id: str, filename: str, pdf_bytes: bytes) -> str:
        suffix = Path(filename).suffix or ".pdf"
        key = f"books/{book_id}{suffix}"
        self._s3.put_object(
            Bucket=self._bucket,
            Key=key,
            Body=pdf_bytes,
            ContentType="application/pdf",
        )
        return key
