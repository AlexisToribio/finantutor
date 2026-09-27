import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { Chat } from "../src/application/chat.js";
import { createApp } from "../src/infrastructure/app.js";
import { SqliteStore } from "../src/infrastructure/store.js";
import { readEvents } from "../src/infrastructure/sse.js";
import {
  AppError,
  chatPartition,
  type Runtime,
  type AgentEvent,
  type Course,
  type Message,
} from "../src/domain/contracts.js";

const complete: AgentEvent = {
  type: "done",
  reply: "El valor depende de la tasa.",
  citations: [],
  activities: [],
};
let store: SqliteStore, course: Course;
const runtime = (events: AgentEvent[]): Runtime => ({
  async *stream() {
    yield* events;
  },
});
beforeEach(async () => {
  store = new SqliteStore(":memory:");
  course = {
    id: randomUUID(),
    owner_id: "student",
    title: "Modelos financieros",
    outline: [],
    created_at: new Date().toISOString(),
  };
  await store.put("user#student", `course#${course.id}`, course);
});
const makeApp = (events: AgentEvent[] = [complete]) =>
  createApp({
    store,
    chat: new Chat(store, runtime(events)),
    authenticate: async (value) => {
      if (value !== "Bearer student") throw new AppError(401, "Inicia sesión.");
      return "student";
    },
    files: {
      async upload() {
        return { url: "/upload", headers: {} };
      },
      async source() {
        return "https://example.invalid";
      },
    },
  });

describe("authorization and course contracts", () => {
  it("requires authentication", async () => {
    expect((await request(makeApp()).get("/api/v1/courses")).status).toBe(401);
  });
  it("does not expose another owner course", async () => {
    const app = makeApp();
    const other = randomUUID();
    await store.put("user#other", `course#${other}`, {
      ...course,
      id: other,
      owner_id: "other",
    });
    expect(
      (
        await request(app)
          .get(`/api/v1/courses/${other}/materials`)
          .set("Authorization", "Bearer student")
      ).status,
    ).toBe(404);
  });
  it("requires PDF filename, size and valid outline", async () => {
    const app = makeApp();
    expect(
      (
        await request(app)
          .post(`/api/v1/courses/${course.id}/materials/uploads`)
          .set("Authorization", "Bearer student")
          .send({
            filename: "script.exe",
            title: "X",
            kind: "theory",
            size: 10,
          })
      ).status,
    ).toBe(422);
    expect(
      (
        await request(app)
          .put(`/api/v1/courses/${course.id}/outline`)
          .set("Authorization", "Bearer student")
          .send({ units: [{ title: "", objective: "" }] })
      ).status,
    ).toBe(422);
  });
});

describe("chat persistence", () => {
  it("commits before exposing done", async () => {
    const session = randomUUID();
    const iterator = new Chat(store, runtime([complete])).execute(
      "student",
      course.id,
      session,
      { prompt: "VAN", mode: "explain" },
    );
    let completed = false;
    for await (const event of iterator)
      if (event.type === "done") {
        completed = true;
        const messages = await store.list<Message>(
          chatPartition("student", course.id, session),
          "message#",
        );
        expect(
          messages.some(
            (message) =>
              message.role === "assistant" && message.body === complete.reply,
          ),
        ).toBe(true);
      }
    expect(completed).toBe(true);
  });
  it("does not persist truncated assistant text", async () => {
    const session = randomUUID();
    await expect(async () => {
      for await (const _event of new Chat(
        store,
        runtime([{ type: "delta", text: "Una respuesta parcial" }]),
      ).execute("student", course.id, session, {
        prompt: "VAN",
        mode: "explain",
      })) {
      }
    }).rejects.toThrow("without completion");
    expect(
      (
        await store.list<Message>(
          chatPartition("student", course.id, session),
          "message#",
        )
      ).filter((item) => item.role === "assistant"),
    ).toHaveLength(0);
  });
  it("rejects error after done and releases lease", async () => {
    const session = randomUUID(),
      chat = new Chat(
        store,
        runtime([complete, { type: "error", message: "Falló" }]),
      );
    await expect(async () => {
      for await (const _event of chat.execute("student", course.id, session, {
        prompt: "VAN",
        mode: "explain",
      })) {
      }
    }).rejects.toThrow();
    expect(
      await store.acquire(chatPartition("student", course.id, session), "next"),
    ).toBe(true);
  });
  it("rejects references to unowned material", async () => {
    const event: AgentEvent = {
      ...complete,
      citations: [
        {
          source_id: "S1",
          material_id: randomUUID(),
          title: "Otro curso",
          version: 1,
        },
      ],
    };
    await expect(async () => {
      for await (const _event of new Chat(store, runtime([event])).execute(
        "student",
        course.id,
        randomUUID(),
        { prompt: "VAN", mode: "explain" },
      )) {
      }
    }).rejects.toThrow("outside authorized");
  });
});

describe("SSE byte transport", () => {
  it("handles UTF-8 fragments and CRLF delimiters", async () => {
    const bytes = new TextEncoder().encode(
      `data: ${JSON.stringify({ type: "delta", text: "Evaluación financiera" })}\r\n\r\n`,
    );
    async function* chunks() {
      for (const byte of bytes) yield Uint8Array.of(byte);
    }
    const events = [];
    for await (const event of readEvents(chunks())) events.push(event);
    expect(events).toEqual([{ type: "delta", text: "Evaluación financiera" }]);
  });
  it("rejects an incomplete terminal event", async () => {
    async function* chunks() {
      yield new TextEncoder().encode(`data: ${JSON.stringify(complete)}`);
    }
    await expect(async () => {
      for await (const _event of readEvents(chunks())) {
      }
    }).rejects.toThrow("Truncated");
  });
});

it("rolls back all turn writes if any activity cannot be serialized", async () => {
  const circular: Record<string, unknown> = {};
  circular.self = circular;
  await expect(
    store.commit([
      { pk: "test", sk: "first", value: { ok: true } },
      { pk: "test", sk: "second", value: circular },
    ]),
  ).rejects.toThrow();
  expect(await store.get("test", "first")).toBeUndefined();
});

it("prevents concurrent turns and permits a new turn after completion", async () => {
  const session = randomUUID(),
    pk = chatPartition("student", course.id, session);
  expect(await store.acquire(pk, "existing")).toBe(true);
  await expect(async () => {
    for await (const _event of new Chat(store, runtime([complete])).execute(
      "student",
      course.id,
      session,
      { prompt: "VAN", mode: "explain" },
    )) {
    }
  }).rejects.toThrow("Ya hay");
  await store.release(pk, "existing");
  expect(await store.acquire(pk, "next")).toBe(true);
});
