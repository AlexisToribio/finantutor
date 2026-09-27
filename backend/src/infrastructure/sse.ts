import { eventSchema, type AgentEvent } from "../domain/contracts.js";
export async function* readEvents(
  bytes: AsyncIterable<Uint8Array>,
): AsyncGenerator<AgentEvent> {
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let buffer = "";
  function parse(block: string): AgentEvent | undefined {
    const data = block
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");
    return data ? eventSchema.parse(JSON.parse(data)) : undefined;
  }
  for await (const chunk of bytes) {
    buffer += decoder.decode(chunk, { stream: true });
    if (buffer.length > 1000000) throw new Error("Stream buffer exceeds limit");
    let match: RegExpExecArray | null;
    while ((match = /\r?\n\r?\n/.exec(buffer))) {
      const event = parse(buffer.slice(0, match.index));
      buffer = buffer.slice(match.index + match[0].length);
      if (event) yield event;
    }
  }
  buffer += decoder.decode();
  // Unterminated data is a truncated event, never an implicit successful completion.
  if (buffer.trim()) throw new Error("Truncated SSE event");
}
