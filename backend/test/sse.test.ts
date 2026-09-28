import { describe, expect, it } from "vitest";

import { parseSseBlocks } from "../src/infrastructure/agentcore/sse.js";

describe("parseSseBlocks", () => {
  it("returns complete events and keeps a partial block", () => {
    const first = parseSseBlocks("");
    const chunk =
      'data: {"type":"status","step":"received","text":"Recibí tu pedido."}\n\n' +
      'data: {"type":"done","reply":"hola"}\n\n' +
      'data: {"type":"heart';
    const parsed = parseSseBlocks(first.rest + chunk);
    expect(parsed.events).toEqual([
      { type: "status", step: "received", text: "Recibí tu pedido." },
      { type: "done", reply: "hola" },
    ]);
    expect(parsed.rest).toBe('data: {"type":"heart');
  });

  it("ignores a block that is not a data line", () => {
    const parsed = parseSseBlocks(": keep-alive\n\n");
    expect(parsed.events).toEqual([]);
    expect(parsed.rest).toBe("");
  });
});
