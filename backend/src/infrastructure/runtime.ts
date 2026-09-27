import {
  BedrockAgentCoreClient,
  InvokeAgentRuntimeCommand,
} from "@aws-sdk/client-bedrock-agentcore";
import type { AgentEvent, Runtime } from "../domain/contracts.js";
import { readEvents } from "./sse.js";
export class HttpRuntime implements Runtime {
  constructor(private url: string) {}
  async *stream(session: string, payload: object): AsyncGenerator<AgentEvent> {
    const response = await fetch(`${this.url}/invocations`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Amzn-Bedrock-AgentCore-Runtime-Session-Id": session,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(110000),
    });
    if (!response.ok || !response.body)
      throw new Error(`Runtime HTTP ${response.status}`);
    yield* readEvents(response.body);
  }
}
export class AwsRuntime implements Runtime {
  readonly client: BedrockAgentCoreClient;
  constructor(
    private arn: string,
    region: string,
  ) {
    this.client = new BedrockAgentCoreClient({ region, maxAttempts: 1 });
  }
  async *stream(session: string, payload: object): AsyncGenerator<AgentEvent> {
    const result = await this.client.send(
      new InvokeAgentRuntimeCommand({
        agentRuntimeArn: this.arn,
        qualifier: "DEFAULT",
        runtimeSessionId: session,
        contentType: "application/json",
        payload: Buffer.from(JSON.stringify(payload)),
      }),
      { abortSignal: AbortSignal.timeout(110000) },
    );
    const body = result.response as
      AsyncIterable<Uint8Array> | Uint8Array | undefined;
    if (!body) throw new Error("Empty AgentCore response");
    const bytes =
      body instanceof Uint8Array
        ? (async function* () {
            yield body;
          })()
        : body;
    yield* readEvents(bytes);
  }
}
