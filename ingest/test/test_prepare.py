import io

import pytest
from pypdf import PdfWriter
from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject

from finantutor_ingest.application.prepare import prepare_pdf


def make_pdf(text: str) -> bytes:
    writer = PdfWriter()
    page = writer.add_blank_page(width=600, height=800)
    font = DictionaryObject(
        {
            NameObject("/Type"): NameObject("/Font"),
            NameObject("/Subtype"): NameObject("/Type1"),
            NameObject("/BaseFont"): NameObject("/Helvetica"),
        }
    )
    page[NameObject("/Resources")] = DictionaryObject(
        {NameObject("/Font"): DictionaryObject({NameObject("/F1"): writer._add_object(font)})}
    )
    stream = DecodedStreamObject()
    stream.set_data(f"BT /F1 12 Tf 50 700 Td ({text}) Tj ET".encode("latin-1"))
    page[NameObject("/Contents")] = writer._add_object(stream)
    output = io.BytesIO()
    writer.write(output)
    return output.getvalue()


def test_pdf_preserves_source_page_and_proposes_only_existing_heading():
    document = prepare_pdf(make_pdf("Unidad 1: Valor actual y evaluacion de proyectos"), "syllabus")
    assert document.pages[0].number == 1
    assert document.outline[0]["title"] == "Unidad 1: Valor actual y evaluacion de proyectos"
    assert document.outline[0]["objective"] == ""
    assert document.outline[0]["source_page"] == "1"
    assert len(document.checksum) == 64


def test_theory_does_not_automatically_become_syllabus():
    assert prepare_pdf(make_pdf("Unidad 1: Valor actual y evaluacion de proyectos")).outline == []


def test_invalid_signature_rejected():
    with pytest.raises(ValueError, match="PDF válido"):
        prepare_pdf(b"This is not a PDF")


def test_scanned_or_empty_page_requires_review():
    with pytest.raises(ValueError, match="texto suficiente"):
        prepare_pdf(make_pdf(""))


def test_encrypted_document_rejected():
    writer = PdfWriter()
    writer.add_blank_page(width=600, height=800)
    writer.encrypt("secret")
    output = io.BytesIO()
    writer.write(output)
    with pytest.raises(ValueError, match="protegido"):
        prepare_pdf(output.getvalue())
