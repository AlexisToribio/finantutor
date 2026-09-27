import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import {
  AppError,
  coursePartition,
  chatPartition,
  type Store,
  type Runtime,
  type Course,
  type Material,
  type Message,
  type Activity,
  type AgentEvent,
} from "../domain/contracts.js";
export const chatInput = z.object({
  prompt: z.string().trim().min(1).max(12000),
  mode: z.enum(["explain", "practice", "case", "review"]).default("explain"),
});
export class Chat {
  constructor(
    private store: Store,
    private runtime: Runtime,
  ) {}
  async *execute(
    owner: string,
    courseId: string,
    sessionId: string,
    input: z.infer<typeof chatInput>,
  ): AsyncGenerator<AgentEvent> {
    z.uuid().parse(courseId);
    z.uuid().parse(sessionId);
    const course = await this.store.get<Course>(
      `user#${owner}`,
      `course#${courseId}`,
    );
    if (!course) throw new AppError(404, "Curso no encontrado.");
    const pk = chatPartition(owner, courseId, sessionId),
      lease = randomUUID();
    if (!(await this.store.acquire(pk, lease)))
      throw new AppError(
        409,
        "Ya hay una respuesta en curso en esta conversación.",
      );
    try {
      const history = (await this.store.list<Message>(pk, "message#")).slice(
        -20,
      );
      const partition = coursePartition(owner, courseId);
      const materials = (
        await this.store.list<Material>(partition, "material#")
      ).filter((item) => item.status === "ready");
      const progress = (
        await this.store.list<Activity>(partition, "activity#")
      ).slice(-30);
      const timestamp = new Date().toISOString();
      await this.store.put(pk, `message#${timestamp}#${lease}`, {
        id: lease,
        role: "user",
        body: input.prompt,
        created_at: timestamp,
      });
      yield { type: "status", text: "Recibí tu pregunta." };
      const session = createHash("sha256").update(pk).digest("hex");
      const scope = {
        owner_id: owner,
        course_id: courseId,
        title: course.title,
        outline: course.outline,
        progress,
        materials: materials.map(({ id, title, version }) => ({
          id,
          title,
          version,
        })),
      };
      let done: Extract<AgentEvent, { type: "done" }> | undefined;
      for await (const event of this.runtime.stream(session, {
        ...input,
        scope,
        history: history.map(({ role, body }) => ({ role, body })),
      })) {
        if (event.type === "done") {
          if (done) throw new Error("Duplicate completion");
          done = event;
        } else if (event.type === "error") {
          throw new Error("Runtime returned an error");
        } else if (done) throw new Error("Events after completion");
        else yield event;
      }
      if (!done) throw new Error("Runtime ended without completion");
      for (const reference of done.citations) {
        if (
          !materials.some(
            (item) =>
              item.id === reference.material_id &&
              String(item.version) === String(reference.version),
          )
        )
          throw new Error("Reference outside authorized catalogue");
      }
      const at = new Date().toISOString(),
        id = randomUUID();
      // Never publish a successful terminal event before its durable writes complete.
      await this.store.commit([
        ...done.activities.map((activity, index) => ({
          pk: partition,
          sk: `activity#${at}#${id}#${index}`,
          value: { ...activity, id: `${id}-${index}`, created_at: at },
        })),
        {
          pk,
          sk: `message#${at}#${id}`,
          value: {
            id,
            role: "assistant",
            body: done.reply,
            citations: done.citations,
            created_at: at,
          },
        },
      ]);
      yield { ...done, message_id: id };
    } finally {
      await this.store.release(pk, lease);
    }
  }
}
