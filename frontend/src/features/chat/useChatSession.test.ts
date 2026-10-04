import { describe, expect, it } from "vitest";

import { API_AGENT } from "../../shared/api/errors";
import { agentReplyText, turnFromMessage } from "./useChatSession";

describe("chat fallback normalization", () => {
  it("uses the fallback for an empty live reply", () => {
    expect(agentReplyText("   ")).toBe(API_AGENT);
    expect(agentReplyText("respuesta útil")).toBe("respuesta útil");
  });

  it("uses the fallback for an empty historical agent message", () => {
    expect(
      turnFromMessage({
        id: 2,
        role: "agent",
        event: "message_replied",
        body: "",
        created_at: "2026-10-03T19:18:11.988-05:00",
        author: "user:student-1",
        schema_version: 1,
        status: "ok",
      }),
    ).toEqual({ role: "agent", text: API_AGENT });
  });
});
