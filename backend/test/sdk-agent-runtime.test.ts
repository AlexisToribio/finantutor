import { describe, expect, it } from "vitest";

import { BedrockAgentCoreClient } from "@aws-sdk/client-bedrock-agentcore";

import { decodeRuntimePayload, SdkAgentRuntime } from "../src/infrastructure/agentcore/sdk-agent-runtime.js";

async function* chunksOf(text: string) {
  yield new TextEncoder().encode(text);
}

describe("decodeRuntimePayload", () => {
  it("parses a JSON object from a byte stream", async () => {
    const body = await decodeRuntimePayload(chunksOf('{"reply":"hola"}'));
    expect(body).toEqual({ reply: "hola" });
  });

  it("rejects empty payloads", async () => {
    await expect(decodeRuntimePayload(undefined)).rejects.toThrow(/empty/);
  });
});

describe("SdkAgentRuntime.stream", () => {
  it("yields each SSE event before the body ends", async () => {
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const encoder = new TextEncoder();
    async function* response() {
      yield encoder.encode(
        'data: {"type":"status","step":"received","text":"Recibí tu pedido."}\n\n',
      );
      await gate;
      yield encoder.encode('data: {"type":"done","reply":"hola"}\n\n');
    }
    const client = {
      send: async () => ({ response: response() }),
    } as unknown as BedrockAgentCoreClient;
    const runtime = new SdkAgentRuntime(client, "arn:aws:bedrock-agentcore:us-east-1:1:runtime/finantutor");
    const iterator = runtime.stream("sess", "hola", "user:1")[Symbol.asyncIterator]();
    const first = await iterator.next();
    expect(first.value).toMatchObject({ type: "status", step: "received" });
    release();
    const second = await iterator.next();
    expect(second.value).toMatchObject({ type: "done", reply: "hola" });
  });
});
