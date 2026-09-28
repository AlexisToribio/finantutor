import { useState, type FormEvent } from "react";

import {
  MAX_PDF_BYTES,
  putPdfToPresignedUrl,
  requestBookUpload,
} from "../../shared/api/books";
import { API_UNAVAILABLE } from "../../shared/api/errors";

export function useBookUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!file || pending) {
      return;
    }
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("Sube un archivo PDF.");
      return;
    }
    if (file.size < 1 || file.size > MAX_PDF_BYTES) {
      setError("El PDF no puede superar 50 MB.");
      return;
    }
    setPending(true);
    setError(null);
    setUploaded(false);
    try {
      const ticket = await requestBookUpload({
        title: file.name.replace(/\.pdf$/i, ""),
        filename: file.name,
      });
      await putPdfToPresignedUrl(ticket, file);
      setUploaded(true);
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : API_UNAVAILABLE;
      setError(message);
    } finally {
      setPending(false);
    }
  }

  return {
    file,
    setFile,
    pending,
    error,
    uploaded,
    submit,
  };
}
