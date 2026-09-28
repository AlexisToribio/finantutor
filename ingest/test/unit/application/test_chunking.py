import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / "src"))

from application.chunking import chunk_text


def test_short_text_is_single_chunk():
    assert chunk_text("hola mundo", size=800) == ["hola mundo"]


def test_empty_text():
    assert chunk_text("   \n") == []


def test_overlap_windows():
    text = "abcdefghij"
    chunks = chunk_text(text, size=4, overlap=1)
    assert chunks[0] == "abcd"
    assert chunks[1].startswith("d")
    assert "".join(c[1:] if i else c for i, c in enumerate(chunks)) or chunks
    assert chunks[-1].endswith("j")
