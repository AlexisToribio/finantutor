import { authHeaders, notifyUnauthorized } from "../auth/apiAuth";
import { API_AGENT, toApiError } from "./errors";
import { getJson, sha256Hex } from "./http";
import { parseSseBlocks } from "./sse";

export type ChatResponse = {
  reply: string;
  session_id: string;
};

export type ConversationMessage = {
  id: number;
  role: "teacher" | "agent";
  event: "message_receive" | "message_replied";
  body: string;
  created_at: string;
  author: string;
  schema_version: number;
  status: "ok" | "error";
};

export type ConversationHistory = {
  session_id: string;
  messages: ConversationMessage[];
};

export async function sendChat(
  prompt: string,
  sessionId: string,
  onStatus: (text: string) => void,
): Promise<ChatResponse> {
  const body = JSON.stringify({ prompt });
  let response: Response;
  try {
    response = await fetch(
      `/api/v1/conversations/${encodeURIComponent(sessionId)}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-amz-content-sha256": await sha256Hex(body),
          ...(await authHeaders()),
        },
        body,
      },
    );
  } catch {
    throw new Error(toApiError(0));
  }
  if (response.status === 401) {
    notifyUnauthorized();
    throw new Error(toApiError(401));
  }
  const type = response.headers.get("content-type") ?? "";
  if (!response.ok || !type.includes("text/event-stream") || !response.body) {
    throw new Error(toApiError(response.status));
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let rest = "";
  let done: ChatResponse | null = null;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) {
      break;
    }
    rest += decoder.decode(chunk.value, { stream: true });
    const parsed = parseSseBlocks(rest);
    rest = parsed.rest;
    for (const event of parsed.events) {
      if (event.type === "status") {
        onStatus(event.text);
      }
      if (event.type === "error") {
        throw new Error(API_AGENT);
      }
      if (event.type === "done") {
        done = chatResponseFromDone(event, sessionId);
      }
    }
  }
  if (!done) {
    throw new Error(API_AGENT);
  }
  return done;
}

function chatResponseFromDone(
  event: Record<string, unknown>,
  sessionId: string,
): ChatResponse {
  return {
    reply: typeof event.reply === "string" ? event.reply : "",
    session_id: typeof event.session_id === "string" ? event.session_id : sessionId,
  };
}

export function listMessages(sessionId: string): Promise<ConversationHistory> {
  return getJson<ConversationHistory>(
    `/api/v1/conversations/${encodeURIComponent(sessionId)}/messages`,
  );
}
