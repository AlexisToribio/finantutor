"""Build the ingest Lambda ZIP for Python 3.12 on Linux x86_64."""

import shutil
import subprocess
from pathlib import Path
from tempfile import TemporaryDirectory
from zipfile import ZIP_DEFLATED, ZipFile

INGEST_ROOT = Path(__file__).resolve().parent.parent

with TemporaryDirectory(prefix="finantutor-ingest-package-") as directory:
    target = Path(directory)
    subprocess.run(
        [
            "uv",
            "pip",
            "install",
            "--python-version",
            "3.12",
            "--python-platform",
            "x86_64-manylinux2014",
            "--target",
            str(target),
            "-r",
            str(INGEST_ROOT / "requirements.txt"),
        ],
        check=True,
    )
    shutil.copytree(
        INGEST_ROOT / "src/finantutor_ingest",
        target / "finantutor_ingest",
        ignore=shutil.ignore_patterns("__pycache__", "*.pyc"),
    )
    dist = INGEST_ROOT / "dist"
    dist.mkdir(exist_ok=True)
    with ZipFile(dist / "ingest.zip", "w", ZIP_DEFLATED) as archive:
        for path in sorted(target.rglob("*")):
            if path.is_file() and "__pycache__" not in path.parts and path.suffix != ".pyc":
                archive.write(path, path.relative_to(target))
print("Created ingest/dist/ingest.zip")
