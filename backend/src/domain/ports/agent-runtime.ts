import type { AgentEvent } from "./agent-events.js";

export type AgentRuntime = {
  stream(
    sessionId: string,
    prompt: string,
    actorId: string,
  ): AsyncIterable<AgentEvent>;
};
