"""Build clean Lambda ZIPs; never package .env files or the editable environment."""

import shutil
import subprocess
from pathlib import Path
from tempfile import TemporaryDirectory
from zipfile import ZIP_DEFLATED, ZipFile

ROOT = Path(__file__).resolve().parent.parent
(ROOT / "backend/dist").mkdir(exist_ok=True)
with ZipFile(ROOT / "backend/dist/backend.zip", "w", ZIP_DEFLATED) as archive:
    archive.write(ROOT / "backend/dist/index.js", "index.js")
with TemporaryDirectory(prefix="finantutor-package-") as directory:
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
            str(ROOT / "ingest/requirements.txt"),
        ],
        check=True,
    )
    shutil.copytree(
        ROOT / "ingest/src/finantutor_ingest",
        target / "finantutor_ingest",
        ignore=shutil.ignore_patterns("__pycache__", "*.pyc"),
    )
    (ROOT / "ingest/dist").mkdir(exist_ok=True)
    with ZipFile(ROOT / "ingest/dist/ingest.zip", "w", ZIP_DEFLATED) as archive:
        for path in sorted(target.rglob("*")):
            if (
                path.is_file()
                and "__pycache__" not in path.parts
                and path.suffix != ".pyc"
            ):
                archive.write(path, path.relative_to(target))
print("Created backend/dist/backend.zip and ingest/dist/ingest.zip")
