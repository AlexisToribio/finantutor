import type { AgentEvent } from "../../domain/ports/agent-events.js";
import { readSseEvents } from "./sse.js";

export class HttpAgentRuntime {
  constructor(private readonly invocationsUrl: string) {}

  async *stream(
    sessionId: string,
    prompt: string,
    actorId: string,
  ): AsyncIterable<AgentEvent> {
    const response = await fetch(this.invocationsUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Amzn-Bedrock-AgentCore-Runtime-Session-Id": sessionId,
      },
      body: JSON.stringify({ prompt, actor_id: actorId }),
    });
    if (!response.ok || !response.body) {
      const body: unknown = await response.json().catch(() => null);
      const detail =
        body && typeof body === "object" && "detail" in body
          ? String((body as { detail: unknown }).detail)
          : `AgentCore HTTP ${response.status}`;
      throw new Error(detail);
    }
    yield* readSseEvents(response.body);
  }
}
