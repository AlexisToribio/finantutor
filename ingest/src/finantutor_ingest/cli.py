"""Ingesta local: el BFF llama el CLI con una ruta controlada y metadatos propios."""

import argparse
import json
from dataclasses import asdict
from pathlib import Path
from uuid import UUID

from finantutor_ingest.application.prepare import prepare_pdf


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--file", required=True)
    parser.add_argument("--metadata", required=True)
    parser.add_argument("--directory", required=True)
    args = parser.parse_args()
    metadata = json.loads(args.metadata)
    UUID(metadata["id"])
    document = prepare_pdf(Path(args.file).read_bytes(), metadata["kind"])
    directory = Path(args.directory) / "index"
    directory.mkdir(parents=True, exist_ok=True)
    result = {
        **metadata,
        "pages": [asdict(page) for page in document.pages],
        "checksum": document.checksum,
        "outline_draft": document.outline,
    }
    path = directory / f"{metadata['id']}.json"
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps(result, ensure_ascii=False))
    temporary.replace(path)
    print(
        json.dumps(
            {
                "checksum": document.checksum,
                "outline_draft": document.outline,
                "page_count": len(document.pages),
            },
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
