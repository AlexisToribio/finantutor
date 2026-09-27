import { token } from "./auth";
export interface Course {
  id: string;
  title: string;
}
export interface Citation {
  source_id: string;
  material_id: string;
  title: string;
  page?: number;
  version: number | string;
}
export interface Message {
  id: string;
  role: "user" | "assistant";
  body: string;
  citations?: Citation[];
  pending?: boolean;
  failed?: boolean;
}
export interface Material {
  id: string;
  title: string;
  filename: string;
  kind: "syllabus" | "theory";
  status: string;
  page_count?: number;
  error?: string;
}
export async function headers(body?: string): Promise<Record<string, string>> {
  const bearer = `Bearer ${await token()}`;
  const values: Record<string, string> = {
    authorization: bearer,
    "x-authorization": bearer,
  };
  if (body !== undefined) {
    values["content-type"] = "application/json";
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(body),
    );
    values["x-amz-content-sha256"] = Array.from(new Uint8Array(digest), (x) =>
      x.toString(16).padStart(2, "0"),
    ).join("");
  }
  return values;
}
export async function request<T>(
  path: string,
  method = "GET",
  value?: unknown,
): Promise<T> {
  const body = value === undefined ? undefined : JSON.stringify(value);
  const response = await fetch(`/api/v1${path}`, {
    method,
    headers: await headers(body),
    body,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const requestId = response.headers.get("x-request-id");
    const detail = error.detail ?? "No se pudo completar la solicitud.";
    throw new Error(
      `${detail} (HTTP ${response.status}${requestId ? `, solicitud ${requestId}` : ""})`,
    );
  }
  return response.json() as Promise<T>;
}
export type Event = {
  type: string;
  text?: string;
  message?: string;
  reply?: string;
  citations?: Citation[];
  message_id?: string;
};
export async function chat(
  path: string,
  prompt: string,
  mode: string,
  onEvent: (event: Event) => void,
  signal: AbortSignal,
): Promise<void> {
  const body = JSON.stringify({ prompt, mode });
  const response = await fetch(`/api/v1${path}`, {
    method: "POST",
    headers: await headers(body),
    body,
    signal,
  });
  if (!response.ok || !response.body) {
    const detail = await response.json().catch(() => ({}));
    const requestId = response.headers.get("x-request-id");
    throw new Error(
      `${detail.detail ?? "No se pudo iniciar la respuesta."} (HTTP ${response.status}${requestId ? `, solicitud ${requestId}` : ""})`,
    );
  }
  const reader = response.body.getReader(),
    decoder = new TextDecoder();
  let buffer = "",
    completed = false;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      if (buffer.length > 1000000)
        throw new Error("La respuesta es demasiado grande.");
      let separator: RegExpExecArray | null;
      while ((separator = /\r?\n\r?\n/.exec(buffer))) {
        const block = buffer.slice(0, separator.index);
        buffer = buffer.slice(separator.index + separator[0].length);
        const data = block
          .split(/\r?\n/)
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trimStart())
          .join("\n");
        if (!data) continue;
        const event = JSON.parse(data) as Event;
        if (event.type === "error")
          throw new Error(event.message ?? "Respuesta interrumpida.");
        if (event.type === "done") completed = true;
        onEvent(event);
      }
    }
    buffer += decoder.decode();
    if (buffer.trim() || !completed)
      throw new Error(
        "La respuesta quedó incompleta. Puedes volver a intentarlo.",
      );
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
}
export async function openSource(
  courseId: string,
  citation: Citation,
): Promise<void> {
  const popup = window.open("about:blank", "_blank");
  if (popup) popup.opener = null;
  try {
    const response = await fetch(
      `/api/v1/courses/${courseId}/materials/${citation.material_id}/source`,
      { headers: await headers() },
    );
    if (!response.ok) throw new Error("No se pudo abrir el material.");
    const url = URL.createObjectURL(await response.blob());
    if (popup)
      popup.location.href = `${url}${citation.page ? `#page=${citation.page}` : ""}`;
    else {
      URL.revokeObjectURL(url);
      throw new Error("Permite ventanas emergentes para abrir la fuente.");
    }
    setTimeout(() => URL.revokeObjectURL(url), 300000);
  } catch (error) {
    popup?.close();
    throw error;
  }
}
