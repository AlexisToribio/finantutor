export type StatusEvent = { type: "status"; step: string; text: string };
export type HeartbeatEvent = { type: "heartbeat" };
export type DoneEvent = { type: "done" } & Record<string, unknown>;
export type ErrorEvent = { type: "error"; message: string };
export type AgentEvent = StatusEvent | HeartbeatEvent | DoneEvent | ErrorEvent;

export function isAgentEvent(value: unknown): value is AgentEvent {
  if (!value || typeof value !== "object" || !("type" in value)) {
    return false;
  }
  const kind = (value as { type: unknown }).type;
  return kind === "status" || kind === "heartbeat" || kind === "done" || kind === "error";
}
