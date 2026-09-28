import { authHeaders, notifyUnauthorized } from "../auth/apiAuth";
import { API_UNAVAILABLE, toApiError } from "./errors";

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function acceptsJsonBody(contentType: string): boolean {
  const type = contentType.toLowerCase();
  return (
    type.includes("application/json") ||
    type.includes("application/octet-stream") ||
    type.trim() === ""
  );
}

function isJsonResponse(response: Response): boolean {
  return acceptsJsonBody(response.headers.get("content-type") ?? "");
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (response.status === 401) {
    notifyUnauthorized();
    throw new Error(toApiError(401));
  }
  if (!response.ok) {
    await response.json().catch(() => null);
    throw new Error(toApiError(response.status));
  }
  if (!isJsonResponse(response)) {
    throw new Error(API_UNAVAILABLE);
  }
  const body: unknown = await response.json().catch(() => null);
  if (body === null) {
    throw new Error(API_UNAVAILABLE);
  }
  return body as T;
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, init);
  } catch {
    throw new Error(API_UNAVAILABLE);
  }
  return parseResponse<T>(response);
}

export async function getJson<T>(path: string): Promise<T> {
  return request<T>(path, {
    headers: await authHeaders(),
  });
}

export async function postJson<T>(path: string, payload: unknown): Promise<T> {
  const body = JSON.stringify(payload);
  return request<T>(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-amz-content-sha256": await sha256Hex(body),
      ...(await authHeaders()),
    },
    body,
  });
}
