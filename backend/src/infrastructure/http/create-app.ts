import express from "express";
import { randomUUID } from "node:crypto";
import { z, ZodError } from "zod";
import {
  AppError,
  coursePartition,
  chatPartition,
  type Course,
  type Material,
  type Store,
  type Files,
  type Message,
} from "../../domain/contracts.js";
import { Chat, chatInput } from "../../application/chat.js";
import { LocalFiles } from "../files.js";
import type { Authenticate } from "../auth.js";
export interface Dependencies {
  store: Store;
  files: Files;
  chat: Chat;
  authenticate: Authenticate;
}
export function createApp(d: Dependencies) {
  const app = express();
  app.disable("x-powered-by");
  app.use("/api/v1", (req, res, next) => {
    const startedAt = Date.now();
    const requestId =
      (req.headers["x-request-id"] as string | undefined) ??
      (req.headers["x-amzn-trace-id"] as string | undefined) ??
      (req.headers["x-amz-apigw-id"] as string | undefined);
    if (requestId) res.setHeader("x-request-id", requestId);
    res.on("finish", () => {
      console.info(
        JSON.stringify({
          event: "http_request_completed",
          request_id: requestId ?? null,
          method: req.method,
          path: req.path,
          status: res.statusCode,
          duration_ms: Date.now() - startedAt,
        }),
      );
    });
    next();
  });
  app.get("/api/v1/health", (_req, res) => res.json({ status: "ok" }));
  if (d.files instanceof LocalFiles) {
    const files = d.files;
    app.put(
      "/api/v1/uploads/:token",
      express.raw({ type: "application/pdf", limit: "50mb" }),
      async (req, res) => {
        if (!Buffer.isBuffer(req.body))
          throw new AppError(400, "Se requiere un PDF.");
        await files.receive(String(req.params.token), req.body);
        res.status(202).json({ status: "indexing" });
      },
    );
  }
  app.use(express.json({ limit: "256kb" }));
  app.use("/api/v1", async (req, res, next) => {
    try {
      res.locals.owner = await d.authenticate(
        (req.headers["x-authorization"] as string | undefined) ??
          req.headers.authorization,
      );
      next();
    } catch (error) {
      next(error);
    }
  });
  const owned = async (owner: string, id: string) => {
    z.uuid().parse(id);
    const course = await d.store.get<Course>(`user#${owner}`, `course#${id}`);
    if (!course) throw new AppError(404, "Curso no encontrado.");
    return course;
  };
  app.get("/api/v1/courses", async (_req, res) =>
    res.json(await d.store.list<Course>(`user#${res.locals.owner}`, "course#")),
  );
  app.post("/api/v1/courses", async (req, res) => {
    const { title } = z
      .object({ title: z.string().trim().min(3).max(200) })
      .parse(req.body);
    const course: Course = {
      id: randomUUID(),
      owner_id: res.locals.owner,
      title,
      created_at: new Date().toISOString(),
    };
    await d.store.put(`user#${course.owner_id}`, `course#${course.id}`, course);
    res.status(201).json(course);
  });
  app.get("/api/v1/courses/:course/materials", async (req, res) => {
    const course = await owned(res.locals.owner, String(req.params.course));
    res.json(
      await d.store.list<Material>(
        coursePartition(course.owner_id, course.id),
        "material#",
      ),
    );
  });
  app.post("/api/v1/courses/:course/materials/uploads", async (req, res) => {
    const course = await owned(res.locals.owner, String(req.params.course));
    const input = z
      .object({
        title: z.string().trim().min(1).max(200),
        filename: z
          .string()
          .min(1)
          .max(200)
          .regex(/\.pdf$/i),
        kind: z.enum(["syllabus", "theory"]),
        unit: z.string().max(200).default(""),
        size: z
          .number()
          .int()
          .min(1)
          .max(50 * 1024 * 1024),
      })
      .parse(req.body);
    const id = randomUUID();
    const material: Material = {
      ...input,
      id,
      owner_id: course.owner_id,
      course_id: course.id,
      version: 1,
      raw_key: `incoming/${course.owner_id}/${course.id}/${id}/source.pdf`,
      status: "uploading",
      created_at: new Date().toISOString(),
    };
    await d.store.put(
      coursePartition(course.owner_id, course.id),
      `material#${id}`,
      material,
    );
    res.status(201).json({ material, ...(await d.files.upload(material)) });
  });
  app.get(
    "/api/v1/courses/:course/materials/:material/source",
    async (req, res) => {
      const course = await owned(res.locals.owner, String(req.params.course));
      z.uuid().parse(req.params.material);
      const material = await d.store.get<Material>(
        coursePartition(course.owner_id, course.id),
        `material#${req.params.material}`,
      );
      if (!material || material.status !== "ready")
        throw new AppError(404, "Material no disponible.");
      const url = await d.files.source(material);
      if (d.files instanceof LocalFiles) res.sendFile(url);
      else res.redirect(url);
    },
  );
  app.get(
    "/api/v1/courses/:course/conversations/:session/messages",
    async (req, res) => {
      const course = await owned(res.locals.owner, String(req.params.course));
      z.uuid().parse(req.params.session);
      res.json(
        await d.store.list<Message>(
          chatPartition(course.owner_id, course.id, String(req.params.session)),
          "message#",
        ),
      );
    },
  );
  app.post(
    "/api/v1/courses/:course/conversations/:session/messages",
    async (req, res) => {
      const input = chatInput.parse(req.body);
      z.uuid().parse(req.params.course);
      z.uuid().parse(req.params.session);
      try {
        for await (const event of d.chat.execute(
          res.locals.owner,
          String(req.params.course),
          String(req.params.session),
          input,
        )) {
          if (!res.headersSent) {
            res.status(200);
            res.set({
              "content-type": "text/event-stream; charset=utf-8",
              "cache-control": "no-cache, no-transform",
              "x-accel-buffering": "no",
            });
            res.flushHeaders();
          }
          res.write(`data: ${JSON.stringify(event)}\n\n`);
        }
        res.end();
      } catch (error) {
        if (!res.headersSent) throw error;
        console.error(
          "chat_failed",
          error instanceof Error ? error.message : "unknown",
        );
        res.write(
          `data: ${JSON.stringify({ type: "error", message: "No se pudo completar la respuesta. Inténtalo de nuevo." })}\n\n`,
        );
        res.end();
      }
    },
  );
  app.use((_req, res) =>
    res.status(404).json({ detail: "Ruta no encontrada." }),
  );
  app.use(
    (
      error: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      console.error(
        JSON.stringify({
          event: "request_failed",
          request_id:
            (_req.headers["x-request-id"] as string | undefined) ??
            (_req.headers["x-amzn-trace-id"] as string | undefined) ??
            (_req.headers["x-amz-apigw-id"] as string | undefined) ??
            null,
          method: _req.method,
          path: _req.path,
          error_name: error instanceof Error ? error.name : "UnknownError",
          error_message:
            error instanceof Error ? error.message : String(error),
          error_stack: error instanceof Error ? error.stack : undefined,
        }),
      );
      const status =
        error instanceof AppError
          ? error.status
          : error instanceof ZodError
            ? 422
            : (error as { status?: number })?.status === 413
              ? 413
              : 500;
      res.status(status).json({
        detail:
          error instanceof AppError
            ? error.message
            : status === 422
              ? "Revisa los datos enviados."
              : status === 413
                ? "El archivo supera el tamaño permitido."
                : "No se pudo completar la solicitud.",
      });
    },
  );
  return app;
}
