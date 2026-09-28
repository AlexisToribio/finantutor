import { BedrockAgentCoreClient } from "@aws-sdk/client-bedrock-agentcore";
import serverless from "serverless-http";

import { ListConversationMessages } from "./application/list-conversation-messages.js";
import {
  AGENT_UNAVAILABLE,
  PostConversationMessage,
} from "./application/post-conversation-message.js";
import { RequestBookUpload } from "./application/request-book-upload.js";
import { SdkAgentRuntime } from "./infrastructure/agentcore/sdk-agent-runtime.js";
import { CognitoAccessTokenVerifier } from "./infrastructure/auth/cognito-jwt-verifier.js";
import { DynamoConversationStore } from "./infrastructure/dynamodb/dynamo-conversation-store.js";
import { createApp } from "./infrastructure/http/create-app.js";
import { responseHeaders } from "./infrastructure/http/response-headers.js";
import { errorMessage, logger } from "./infrastructure/observability/logger.js";
import { S3IncomingObjectStore } from "./infrastructure/s3/s3-incoming-object-store.js";

type FunctionUrlEvent = {
  rawPath: string;
  body?: string;
  isBase64Encoded?: boolean;
  headers?: Record<string, string | undefined>;
  requestContext: { http: { method: string } };
};

type BufferedResult = {
  statusCode?: number;
  headers?: Record<string, string | string[] | undefined>;
  body?: string;
  isBase64Encoded?: boolean;
};

const region = process.env.AWS_REGION ?? "us-east-1";
const runtimeArn = process.env.AGENTCORE_RUNTIME_ARN ?? "";
const qualifier = process.env.AGENTCORE_QUALIFIER ?? "DEFAULT";
const tableName = process.env.CONVERSATIONS_TABLE ?? "";
const booksBucket = process.env.BOOKS_BUCKET ?? "";
const userPoolId = process.env.COGNITO_USER_POOL_ID ?? "";
const clientId = process.env.COGNITO_CLIENT_ID ?? "";
if (!userPoolId || !clientId) {
  throw new Error("COGNITO_USER_POOL_ID and COGNITO_CLIENT_ID are required");
}
if (!booksBucket) {
  throw new Error("BOOKS_BUCKET is required");
}
const store = DynamoConversationStore.fromEnv(tableName, region);
const runtime = new SdkAgentRuntime(
  new BedrockAgentCoreClient({ region }),
  runtimeArn,
  qualifier,
);
const verifier = CognitoAccessTokenVerifier.fromEnv(userPoolId, clientId);
const postMessage = new PostConversationMessage(runtime, store);

const app = createApp(
  postMessage,
  new ListConversationMessages(store),
  new RequestBookUpload(new S3IncomingObjectStore(booksBucket)),
  verifier,
);

const buffered = serverless(app) as (
  event: FunctionUrlEvent,
  context: unknown,
) => Promise<BufferedResult>;

function header(event: FunctionUrlEvent, name: string): string | undefined {
  const headers = event.headers ?? {};
  const found = Object.entries(headers).find(([key]) => key.toLowerCase() === name);
  return found?.[1];
}

function isChatPost(event: FunctionUrlEvent): boolean {
  return (
    event.requestContext.http.method === "POST" &&
    /\/api\/v1\/conversations\/[^/]+\/messages$/.test(event.rawPath)
  );
}

function writeJson(
  responseStream: NodeJS.WritableStream,
  statusCode: number,
  body: unknown,
): void {
  const stream = awslambda.HttpResponseStream.from(responseStream, {
    statusCode,
    headers: responseHeaders(undefined, "application/json"),
  });
  stream.write(JSON.stringify(body));
  stream.end();
}

async function streamChat(
  event: FunctionUrlEvent,
  responseStream: NodeJS.WritableStream,
): Promise<void> {
  const tokenHeader = header(event, "x-authorization") ?? header(event, "authorization");
  const token = tokenHeader?.startsWith("Bearer ") ? tokenHeader.slice("Bearer ".length) : "";
  let userId = "";
  if (token) {
    try {
      userId = (await verifier.verify(token)).userId;
    } catch {
      userId = "";
    }
  }
  if (!userId) {
    writeJson(responseStream, 401, { detail: "Unauthorized" });
    return;
  }

  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body ?? "", "base64").toString("utf8")
    : (event.body ?? "");
  let prompt = "";
  try {
    const parsed = JSON.parse(rawBody) as { prompt?: unknown };
    prompt = typeof parsed.prompt === "string" ? parsed.prompt : "";
  } catch {
    prompt = "";
  }
  const sessionId = event.rawPath.split("/").at(-2) ?? "";
  let opened = false;
  let stream: (NodeJS.WritableStream & { end: () => void }) | undefined;
  try {
    for await (const agentEvent of postMessage.execute(userId, sessionId, prompt)) {
      if (!opened) {
        stream = awslambda.HttpResponseStream.from(responseStream, {
          statusCode: 200,
          headers: responseHeaders(
            {
              "cache-control": "no-cache, no-transform",
              "x-accel-buffering": "no",
            },
            "text/event-stream; charset=utf-8",
          ),
        });
        opened = true;
      }
      stream?.write(`data: ${JSON.stringify(agentEvent)}\n\n`);
    }
    if (!opened || !stream) {
      writeJson(responseStream, 502, { detail: AGENT_UNAVAILABLE });
      return;
    }
    stream.end();
  } catch (error) {
    const message = errorMessage(error);
    if (!opened) {
      const status =
        message === "prompt is required" || message === "session_id is required" ? 422 : 502;
      writeJson(responseStream, status, {
        detail: status === 422 ? message : AGENT_UNAVAILABLE,
      });
      return;
    }
    logger.error("chat.stream.failed", { error: message });
    stream?.write(`data: ${JSON.stringify({ type: "error", message: AGENT_UNAVAILABLE })}\n\n`);
    stream?.end();
  }
}

export const handler = awslambda.streamifyResponse(async (event, responseStream, context) => {
  const httpEvent = event as FunctionUrlEvent;
  if (!isChatPost(httpEvent)) {
    const result = await buffered(httpEvent, context);
    const stream = awslambda.HttpResponseStream.from(responseStream, {
      statusCode: result.statusCode ?? 200,
      headers: responseHeaders(result.headers, "application/json"),
    });
    if (result.body) {
      stream.write(result.isBase64Encoded ? Buffer.from(result.body, "base64") : result.body);
    }
    stream.end();
    return;
  }
  await streamChat(httpEvent, responseStream);
});
