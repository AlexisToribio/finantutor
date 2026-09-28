export type ParsedSse =
  | { type: "status"; step: string; text: string }
  | { type: "heartbeat" }
  | ({ type: "done" } & Record<string, unknown>)
  | { type: "error"; message: string };

function isParsedSse(value: unknown): value is ParsedSse {
  if (!value || typeof value !== "object" || !("type" in value)) {
    return false;
  }
  const kind = (value as { type: unknown }).type;
  return kind === "status" || kind === "heartbeat" || kind === "done" || kind === "error";
}

export function parseSseBlocks(buffer: string): { events: ParsedSse[]; rest: string } {
  const parts = buffer.split("\n\n");
  const rest = parts.pop() ?? "";
  const events: ParsedSse[] = [];
  for (const part of parts) {
    const line = part.split("\n").find((item) => item.startsWith("data: "));
    if (!line) {
      continue;
    }
    try {
      const parsed: unknown = JSON.parse(line.slice("data: ".length));
      if (isParsedSse(parsed)) {
        events.push(parsed);
      }
    } catch {
      continue;
    }
  }
  return { events, rest };
}
