#!/usr/bin/env python3
"""Ingest a teacher book PDF into S3 and the S3 Vectors index."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from dotenv import load_dotenv

INGEST_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(INGEST_ROOT / "src"))

load_dotenv(INGEST_ROOT / ".env")

from application.use_cases.ingest_book import IngestBookRequest
from infrastructure.composition import build_ingest_use_case
from infrastructure.config.settings import load_settings


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--file", required=True, help="Path to a text-extractable PDF")
    parser.add_argument("--title", help="Material title (defaults to the PDF filename)")
    parser.add_argument(
        "--subject",
        default="Modelos financieros y evaluación de proyectos",
        help="Course name used to scope the material index",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Print result as JSON",
    )
    args = parser.parse_args()

    pdf_path = Path(args.file)
    pdf_bytes = pdf_path.read_bytes()
    use_case = build_ingest_use_case(load_settings())
    result = use_case.execute(
        IngestBookRequest(
            filename=pdf_path.name,
            title=args.title or pdf_path.stem,
            subject=args.subject,
            pdf_bytes=pdf_bytes,
        )
    )
    payload = {
        "book_id": result.book_id,
        "source_key": result.source_key,
        "chunk_count": result.chunk_count,
    }
    if args.json:
        print(json.dumps(payload, ensure_ascii=False), flush=True)
    else:
        print(
            f"Ingested {result.chunk_count} chunks "
            f"book_id={result.book_id} key={result.source_key}"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
