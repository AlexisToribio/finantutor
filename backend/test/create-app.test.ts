import { describe, expect, it } from "vitest";
import request from "supertest";

import { ListConversationMessages } from "../src/application/list-conversation-messages.js";
import { PostConversationMessage } from "../src/application/post-conversation-message.js";
import {
  RequestBookUpload,
  type IncomingObjectStore,
} from "../src/application/request-book-upload.js";
import { createApp } from "../src/infrastructure/http/create-app.js";
import { conversationSource } from "../src/domain/ports/conversation-store.js";
import { InMemoryConversationStore } from "../src/infrastructure/memory/in-memory-conversation-store.js";
import type { AgentEvent } from "../src/domain/ports/agent-events.js";
import type { AgentRuntime } from "../src/domain/ports/agent-runtime.js";
import {
  UnauthorizedError,
  type TokenVerifier,
} from "../src/domain/ports/token-verifier.js";

class FakeRuntime implements AgentRuntime {
  public calls: Array<{ sessionId: string; prompt: string; actorId: string }> = [];
  public error: Error | null = null;
  public events: AgentEvent[] | null = null;

  async *stream(sessionId: string, prompt: string, actorId: string): AsyncIterable<AgentEvent> {
    this.calls.push({ sessionId, prompt, actorId });
    if (this.error) {
      throw this.error;
    }
    if (this.events) {
      for (const event of this.events) {
        yield event;
      }
      return;
    }
    yield { type: "status", step: "received", text: "Recibí tu pedido." };
    yield {
      type: "done",
      reply: `echo:${prompt}`,
      session_id: sessionId,
    };
  }
}

class FakeIncoming implements IncomingObjectStore {
  public json: Array<{ key: string; body: Record<string, unknown> }> = [];

  async putJson(key: string, body: Record<string, unknown>) {
    this.json.push({ key, body });
  }

  async presignPut(key: string) {
    return `https://s3.example/${key}`;
  }
}

class FakeVerifier implements TokenVerifier {
  async verify(token: string) {
    if (token === "invalid") {
      throw new UnauthorizedError();
    }
    return { userId: token };
  }
}

const teacher = { Authorization: "Bearer teacher-1" };

function appWith(
  runtime = new FakeRuntime(),
  incoming = new FakeIncoming(),
) {
  const store = new InMemoryConversationStore();
  return {
    client: request(
      createApp(
        new PostConversationMessage(runtime, store),
        new ListConversationMessages(store),
        new RequestBookUpload(incoming, () => "uuid-1"),
        new FakeVerifier(),
      ),
    ),
    runtime,
    incoming,
    store,
  };
}

describe("HTTP API v1", () => {
  it("returns health without a token", async () => {
    const { client } = appWith();
    const response = await client.get("/api/v1/health");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });

  it("rejects chat without a token", async () => {
    const { client } = appWith();
    const response = await client
      .post("/api/v1/conversations/sess-9/messages")
      .send({ prompt: "hola" });
    expect(response.status).toBe(401);
  });

  it("rejects an invalid token", async () => {
    const { client } = appWith();
    const response = await client
      .get("/api/v1/conversations/sess-9/messages")
      .set({ Authorization: "Bearer invalid" });
    expect(response.status).toBe(401);
  });

  it("accepts the JWT on X-Authorization when Authorization is SigV4", async () => {
    const { client } = appWith();
    const response = await client
      .get("/api/v1/conversations/sess-9/messages")
      .set({
        Authorization: "AWS4-HMAC-SHA256 Credential=cloudfront",
        "X-Authorization": "Bearer teacher-1",
      });
    expect(response.status).toBe(200);
  });

  it("prefers X-Authorization over a Bearer Authorization that is not the JWT", async () => {
    const { client } = appWith();
    const response = await client
      .get("/api/v1/conversations/sess-9/messages")
      .set({
        Authorization: "Bearer invalid",
        "X-Authorization": "Bearer teacher-1",
      });
    expect(response.status).toBe(200);
  });

  it("rejects books without a token", async () => {
    const { client } = appWith();
    const response = await client.post("/api/v1/books/uploads").send({
      filename: "libro.pdf",
      title: "Mate 3",
    });
    expect(response.status).toBe(401);
  });

  it("posts a message, persists both turns, and lists them", async () => {
    const { client, runtime } = appWith();
    const posted = await client
      .post("/api/v1/conversations/sess-9/messages")
      .set(teacher)
      .send({ prompt: "¿Cómo se interpreta el VAN?" });
    expect(posted.status).toBe(200);
    expect(posted.headers["content-type"]).toContain("text/event-stream");
    expect(posted.text).toContain(
      'data: {"type":"status","step":"received","text":"Recibí tu pedido."}',
    );
    expect(posted.text).toContain('"type":"done"');
    expect(posted.text).toContain('"reply":"echo:¿Cómo se interpreta el VAN?"');
    expect(runtime.calls).toEqual([
      {
        sessionId: "sess-9",
        prompt: "¿Cómo se interpreta el VAN?",
        actorId: "user:teacher-1",
      },
    ]);

    const listed = await client
      .get("/api/v1/conversations/sess-9/messages")
      .set(teacher);
    expect(listed.status).toBe(200);
    expect(listed.body.messages).toHaveLength(2);
    expect(listed.body.messages[0]).toMatchObject({
      id: 1,
      role: "teacher",
      event: "message_receive",
      body: "¿Cómo se interpreta el VAN?",
      author: "user:teacher-1",
      status: "ok",
    });
    expect(listed.body.messages[1]).toMatchObject({
      id: 2,
      role: "agent",
      event: "message_replied",
      body: "echo:¿Cómo se interpreta el VAN?",
      author: "user:teacher-1",
      status: "ok",
    });
  });

  it("does not leak another user's conversation", async () => {
    const { client } = appWith();
    await client
      .post("/api/v1/conversations/sess-9/messages")
      .set(teacher)
      .send({ prompt: "secreto" });
    const listed = await client
      .get("/api/v1/conversations/sess-9/messages")
      .set({ Authorization: "Bearer teacher-2" });
    expect(listed.status).toBe(200);
    expect(listed.body.messages).toEqual([]);
  });

  it("rejects empty prompt", async () => {
    const { client } = appWith();
    const response = await client
      .post("/api/v1/conversations/s/messages")
      .set(teacher)
      .send({ prompt: "  " });
    expect(response.status).toBe(422);
  });

  it("keeps the teacher turn when AgentCore fails", async () => {
    const runtime = new FakeRuntime();
    runtime.error = new Error("runtime down");
    const { client } = appWith(runtime);
    const posted = await client
      .post("/api/v1/conversations/sess-err/messages")
      .set(teacher)
      .send({ prompt: "hola" });
    expect(posted.status).toBe(502);
    expect(posted.body.detail).toBe("El asistente no respondió. Inténtalo de nuevo.");
    expect(posted.body.detail).not.toContain("runtime down");

    const listed = await client
      .get("/api/v1/conversations/sess-err/messages")
      .set(teacher);
    expect(listed.body.messages).toHaveLength(1);
    expect(listed.body.messages[0]).toMatchObject({
      role: "teacher",
      event: "message_receive",
      body: "hola",
      author: "user:teacher-1",
      status: "ok",
    });
  });

  it("keeps only the teacher turn when the agent emits an error event", async () => {
    const runtime = new FakeRuntime();
    runtime.events = [
      { type: "status", step: "received", text: "Recibí tu pedido." },
      { type: "error", message: "El asistente no respondió. Inténtalo de nuevo." },
    ];
    const { client } = appWith(runtime);
    const posted = await client
      .post("/api/v1/conversations/sess-agent-err/messages")
      .set(teacher)
      .send({ prompt: "hola" });
    expect(posted.status).toBe(200);
    expect(posted.headers["content-type"]).toContain("text/event-stream");
    expect(posted.text).toContain("El asistente no respondió. Inténtalo de nuevo.");
    expect(posted.text).not.toContain("AccessDenied");

    const listed = await client
      .get("/api/v1/conversations/sess-agent-err/messages")
      .set(teacher);
    expect(listed.body.messages).toHaveLength(1);
    expect(listed.body.messages[0]).toMatchObject({ role: "teacher", body: "hola" });
  });

  it("hides stored infrastructure errors from the chat history", async () => {
    const { client, store } = appWith();
    await store.append(conversationSource("teacher-1", "sess-iam"), {
      role: "agent",
      event: "message_replied",
      body: "User: arn:aws:sts::123:assumed-role/finantutor-bff-dev-role is not authorized to perform: bedrock-agentcore:InvokeAgentRuntime",
      author: "user:teacher-1",
      status: "error",
    });

    const listed = await client
      .get("/api/v1/conversations/sess-iam/messages")
      .set(teacher);
    expect(listed.body.messages[0]).toMatchObject({
      status: "error",
      body: "El asistente no respondió. Inténtalo de nuevo.",
    });
    expect(listed.body.messages[0].body).not.toContain("arn:aws");
  });

  it("presigns a namespaced incoming pdf", async () => {
    const { client, incoming } = appWith();
    const response = await client
      .post("/api/v1/books/uploads")
      .set(teacher)
      .send({
        filename: "fracciones.pdf",
        title: "Mate 3",
      });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      upload_url: "https://s3.example/incoming/teacher-1/uuid-1.pdf",
      method: "PUT",
      headers: { "Content-Type": "application/pdf" },
      object_key: "incoming/teacher-1/uuid-1.pdf",
      expires_in: 900,
    });
    expect(incoming.json[0]?.key).toBe("incoming/teacher-1/uuid-1.json");
    expect(incoming.json[0]?.body).toMatchObject({
      user_id: "teacher-1",
      title: "Mate 3",
      subject: "Modelos financieros y evaluación de proyectos",
    });
  });

  it("returns 410 for the old multipart books route", async () => {
    const { client, incoming } = appWith();
    const response = await client.post("/api/v1/books").set(teacher).send({});
    expect(response.status).toBe(410);
    expect(incoming.json).toHaveLength(0);
  });

  it("rejects a non-pdf filename", async () => {
    const { client, incoming } = appWith();
    const response = await client
      .post("/api/v1/books/uploads")
      .set(teacher)
      .send({
        filename: "notas.txt",
        title: "Mate 3",
      });
    expect(response.status).toBe(422);
    expect(incoming.json).toHaveLength(0);
  });

  it("rejects a missing material title", async () => {
    const { client } = appWith();
    const response = await client
      .post("/api/v1/books/uploads")
      .set(teacher)
      .send({
        filename: "libro.pdf",
      });
    expect(response.status).toBe(422);
    expect(response.body.detail).toBe("Title is required");
  });
});
