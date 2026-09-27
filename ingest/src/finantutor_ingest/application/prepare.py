import hashlib
import io

from pypdf import PdfReader

from finantutor_ingest.domain.document import Document, Page

MAX_BYTES = 50 * 1024 * 1024


def prepare_pdf(data: bytes, kind: str = "theory") -> Document:
    """Valida el PDF y extrae solo contenido existente; escaneados requieren OCR previo."""
    if not 1 <= len(data) <= MAX_BYTES or not data.startswith(b"%PDF-"):
        raise ValueError("Se requiere un PDF válido de hasta 50 MB.")
    reader = PdfReader(io.BytesIO(data), strict=False)
    if reader.is_encrypted:
        raise ValueError("El PDF está protegido. Sube una copia sin contraseña.")
    if not 1 <= len(reader.pages) <= 500:
        raise ValueError("El PDF debe tener entre 1 y 500 páginas.")
    pages = []
    for index, page in enumerate(reader.pages, start=1):
        text = (page.extract_text() or "").strip()
        if len(text) < 20:
            raise ValueError(
                f"La página {index} no tiene texto suficiente. Verifica su extracción u OCR."
            )
        if len(text) > 100000:
            raise ValueError("Una página contiene demasiado texto para indexarse.")
        pages.append(Page(index, text))
    return Document(hashlib.sha256(data).hexdigest(), pages)
