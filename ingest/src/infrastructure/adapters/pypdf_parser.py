from io import BytesIO

from pypdf import PdfReader

from domain.entities.page_text import PageText
from domain.ports.document_parser import DocumentParser


class PypdfDocumentParser(DocumentParser):
    def parse(self, pdf_bytes: bytes) -> list[PageText]:
        reader = PdfReader(BytesIO(pdf_bytes))
        pages: list[PageText] = []
        for number, page in enumerate(reader.pages, start=1):
            text = page.extract_text() or ""
            pages.append(PageText(page=number, text=text))
        return pages
