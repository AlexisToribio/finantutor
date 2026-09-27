import { it, expect } from "vitest";
import request from "supertest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { execFileSync } from "node:child_process";
import { createApp } from "../src/infrastructure/app.js";
import { LocalFiles } from "../src/infrastructure/files.js";
import { SqliteStore } from "../src/infrastructure/store.js";
import { Chat } from "../src/application/chat.js";
import {
  AppError,
  type Course,
  type Material,
} from "../src/domain/contracts.js";

it("uploads, extracts, confirms and authorizes a real PDF, preserving the catalogue after restart", async () => {
  const directory = await mkdtemp(join(tmpdir(), "finantutor-ingest-"));
  const python = resolve("../ingest/.venv/bin/python");
  const store = new SqliteStore(join(directory, "app.db"));
  try {
    const pdf = execFileSync(
      python,
      [
        "-c",
        "import sys; sys.path.insert(0, '../ingest/test'); from test_prepare import make_pdf; sys.stdout.buffer.write(make_pdf('Unidad 1: Valor actual neto y evaluacion de proyectos'))",
      ],
      { cwd: resolve(".") },
    );
    const files = new LocalFiles(directory, python, store);
    const app = createApp({
      store,
      files,
      authenticate: async (value) => {
        if (value !== "Bearer student")
          throw new AppError(401, "Sesión requerida");
        return "student";
      },
      chat: new Chat(store, {
        async *stream() {
          throw new Error("Not used");
        },
      }),
    });
    const created = await request(app)
      .post("/api/v1/courses")
      .set("Authorization", "Bearer student")
      .send({ title: "Modelos financieros" });
    expect(created.status).toBe(201);
    const course = created.body as Course;
    const base = `/api/v1/courses/${course.id}`;
    const upload = await request(app)
      .post(`${base}/materials/uploads`)
      .set("Authorization", "Bearer student")
      .send({
        title: "Sílabo de ejemplo",
        filename: "syllabus.pdf",
        kind: "syllabus",
        size: pdf.length,
      });
    expect(upload.status).toBe(201);
    expect(
      (
        await request(app)
          .put(upload.body.url)
          .set("Content-Type", "application/pdf")
          .send(pdf)
      ).status,
    ).toBe(202);
    expect(
      (
        await request(app)
          .put(upload.body.url)
          .set("Content-Type", "application/pdf")
          .send(pdf)
      ).status,
    ).toBe(403);
    let material: Material | undefined;
    for (let attempt = 0; attempt < 100; attempt++) {
      const response = await request(app)
        .get(`${base}/materials`)
        .set("Authorization", "Bearer student");
      material = response.body[0];
      if (material?.status === "ready" || material?.status === "failed") break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    expect(material?.status).toBe("ready");
    expect(material?.page_count).toBe(1);
    const index = JSON.parse(
      await readFile(join(directory, "index", `${material!.id}.json`), "utf8"),
    );
    expect(index.owner_id).toBe("student");
    expect(index.course_id).toBe(course.id);
    expect(index.pages[0].text).toContain("Valor actual");
    const outline = await request(app)
      .put(`${base}/outline`)
      .set("Authorization", "Bearer student")
      .send({
        units: material!.outline_draft,
        source_material_id: material!.id,
      });
    expect(outline.status).toBe(200);
    expect(outline.body.outline[0].source_page).toBe("1");
    expect(
      (await request(app).get(`${base}/materials/${material!.id}/source`))
        .status,
    ).toBe(401);
    expect(
      (
        await request(app)
          .get(`${base}/materials/${material!.id}/source`)
          .set("Authorization", "Bearer student")
      ).status,
    ).toBe(200);
    store.database.close();
    const restored = new SqliteStore(join(directory, "app.db"));
    expect(
      (await restored.get<Course>("user#student", `course#${course.id}`))
        ?.outline,
    ).toHaveLength(1);
    restored.database.close();
  } finally {
    if (store.database.isOpen) store.database.close();
    await rm(directory, { recursive: true, force: true });
  }
}, 15000);
