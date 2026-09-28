export function responseHeaders(
  source: Record<string, string | string[] | undefined> | undefined,
  contentType: string,
): Record<string, string> {
  const headers: Record<string, string> = {};
  let resolved = contentType;
  for (const [key, value] of Object.entries(source ?? {})) {
    if (value === undefined) continue;
    const text = Array.isArray(value) ? value.join(",") : value;
    if (key.toLowerCase() === "content-type") {
      if (text) resolved = text;
      continue;
    }
    headers[key] = text;
  }
  headers["Content-Type"] = resolved;
  return headers;
}
