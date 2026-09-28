import { API_UNAVAILABLE } from "./errors";
import { postJson } from "./http";

export const MAX_PDF_BYTES = 50 * 1024 * 1024;

export type BookUploadTicket = {
  upload_url: string;
  method: "PUT";
  headers: Record<string, string>;
  object_key: string;
  expires_in: number;
};

export type BookUploadRequest = {
  title: string;
  filename: string;
};

export function requestBookUpload(
  input: BookUploadRequest,
): Promise<BookUploadTicket> {
  return postJson<BookUploadTicket>("/api/v1/books/uploads", input);
}

export async function putPdfToPresignedUrl(
  ticket: BookUploadTicket,
  file: File,
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(ticket.upload_url, {
      method: ticket.method,
      headers: ticket.headers,
      body: file,
    });
  } catch {
    throw new Error(API_UNAVAILABLE);
  }
  if (!response.ok) {
    throw new Error(API_UNAVAILABLE);
  }
}
