import {
  BedrockAgentCoreClient,
  InvokeAgentRuntimeCommand,
} from "@aws-sdk/client-bedrock-agentcore";

import type { AgentEvent } from "../../domain/ports/agent-events.js";
import { errorMessage, errorName, logger } from "../observability/logger.js";
import { readSseEvents } from "./sse.js";

export async function decodeRuntimePayload(
  stream: AsyncIterable<Uint8Array> | Uint8Array | undefined,
): Promise<Record<string, unknown>> {
  if (!stream) {
    throw new Error("AgentCore returned an empty response");
  }
  const chunks: Uint8Array[] = [];
  if (stream instanceof Uint8Array) {
    chunks.push(stream);
  } else {
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
  }
  const text = Buffer.concat(chunks.map((c) => Buffer.from(c))).toString("utf8").trim();
  if (!text) {
    throw new Error("AgentCore returned an empty response");
  }
  const parsed: unknown = JSON.parse(text);
  if (!parsed || typeof parsed !== "object") {
    throw new Error("AgentCore returned a non-object response");
  }
  return parsed as Record<string, unknown>;
}

export class SdkAgentRuntime {
  constructor(
    private readonly client: BedrockAgentCoreClient,
    private readonly agentRuntimeArn: string,
    private readonly qualifier = "DEFAULT",
  ) {}

  async *stream(
    sessionId: string,
    prompt: string,
    actorId: string,
  ): AsyncIterable<AgentEvent> {
    logger.info("agentcore.invoke.received", {
      session_id: sessionId,
      actor_id: actorId,
      prompt_chars: prompt.length,
      prompt_preview: prompt.slice(0, 120),
      runtime_arn_suffix: this.agentRuntimeArn.slice(-24),
      qualifier: this.qualifier,
    });
    let response;
    try {
      response = await this.client.send(
        new InvokeAgentRuntimeCommand({
          agentRuntimeArn: this.agentRuntimeArn,
          qualifier: this.qualifier,
          runtimeSessionId: sessionId,
          contentType: "application/json",
          payload: Buffer.from(JSON.stringify({ prompt, actor_id: actorId })),
        }),
      );
    } catch (error) {
      logger.error("agentcore.invoke.failed", {
        session_id: sessionId,
        error_name: errorName(error),
        error: errorMessage(error),
      });
      throw error;
    }
    const body = response.response as AsyncIterable<Uint8Array> | Uint8Array | undefined;
    if (!body) {
      throw new Error("AgentCore returned an empty response");
    }
    const bytes =
      body instanceof Uint8Array
        ? (async function* () {
            yield body;
          })()
        : body;
    let sawTerminal = false;
    for await (const event of readSseEvents(bytes)) {
      if (event.type === "done" || event.type === "error") {
        sawTerminal = true;
        const reply = event.type === "done" && typeof event.reply === "string" ? event.reply : "";
        logger.info("agentcore.invoke.responded", {
          session_id: sessionId,
          event_type: event.type,
          reply_chars: reply.length,
        });
      }
      yield event;
    }
    if (!sawTerminal) {
      throw new Error("AgentCore stream ended without a terminal event");
    }
  }
}
