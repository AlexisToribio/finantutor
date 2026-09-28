import { describe, expect, it } from "vitest";

import { parseSseBlocks } from "./sse";

describe("parseSseBlocks", () => {
  it("returns complete events and keeps a partial block", () => {
    const chunk =
      'data: {"type":"status","step":"received","text":"Recibí tu pedido."}\n\n' +
      'data: {"type":"done","reply":"hola"}\n\n' +
      'data: {"type":"heart';
    const parsed = parseSseBlocks(chunk);
    expect(parsed.events).toEqual([
      { type: "status", step: "received", text: "Recibí tu pedido." },
      { type: "done", reply: "hola" },
    ]);
    expect(parsed.rest).toBe('data: {"type":"heart');
  });
});
