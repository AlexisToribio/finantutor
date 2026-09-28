import { isAgentEvent, type AgentEvent } from "../../domain/ports/agent-events.js";

export function parseSseBlocks(buffer: string): { events: AgentEvent[]; rest: string } {
  const parts = buffer.split("\n\n");
  const rest = parts.pop() ?? "";
  const events: AgentEvent[] = [];
  for (const part of parts) {
    const line = part.split("\n").find((item) => item.startsWith("data: "));
    if (!line) {
      continue;
    }
    try {
      const parsed: unknown = JSON.parse(line.slice("data: ".length));
      if (isAgentEvent(parsed)) {
        events.push(parsed);
      }
    } catch {
      continue;
    }
  }
  return { events, rest };
}

export async function* readSseEvents(
  bytes: AsyncIterable<Uint8Array>,
): AsyncGenerator<AgentEvent> {
  const decoder = new TextDecoder();
  let rest = "";
  for await (const chunk of bytes) {
    rest += decoder.decode(chunk, { stream: true });
    const parsed = parseSseBlocks(rest);
    rest = parsed.rest;
    for (const event of parsed.events) {
      yield event;
    }
  }
  rest += decoder.decode();
  const tail = parseSseBlocks(rest.endsWith("\n\n") ? rest : `${rest}\n\n`);
  for (const event of tail.events) {
    yield event;
  }
}
