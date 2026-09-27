import { test, expect } from "@playwright/test";
const id = "b2ca47ac-23e7-46d8-98aa-55caaad29059";
const materialId = "d79b60d0-2c94-4181-91db-95312ef7a08b";
test("study workflow: upload, confirm outline, chat citations, progress and responsive layout", async ({
  page,
}, testInfo) => {
  let course = {
    id,
    title: "Modelos financieros y evaluación de proyectos",
    outline: [] as object[],
  };
  const units = [
    { title: "Unidad 1: Valor actual neto", objective: "", source_page: "1" },
  ];
  let uploaded = false,
    completed = false;
  const material = {
    id: materialId,
    title: "Sílabo de ejemplo",
    filename: "syllabus.pdf",
    kind: "syllabus",
    status: "ready",
    page_count: 1,
    outline_draft: units,
  };
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request(),
      path = new URL(request.url()).pathname;
    if (path.includes("/uploads/") && request.method() === "PUT") {
      uploaded = true;
      return route.fulfill({ status: 202, json: { status: "indexing" } });
    }
    if (path.endsWith("/materials/uploads"))
      return route.fulfill({
        status: 201,
        json: {
          material,
          url: "/api/v1/uploads/capability",
          headers: { "content-type": "application/pdf" },
        },
      });
    if (path.endsWith("/materials"))
      return route.fulfill({ json: uploaded ? [material] : [] });
    if (path.endsWith("/outline")) {
      course = { ...course, outline: request.postDataJSON().units };
      return route.fulfill({ json: course });
    }
    if (path.endsWith("/progress"))
      return route.fulfill({
        json: completed
          ? [
              {
                id: "activity",
                topic: "VAN",
                outcome: "studied",
                evidence: "Revisó el significado del VAN.",
                created_at: "2026-09-27T10:00:00Z",
              },
            ]
          : [],
      });
    if (path.endsWith("/messages")) {
      if (request.method() === "GET") return route.fulfill({ json: [] });
      completed = true;
      const reply =
        "El **VAN** descuenta los flujos futuros. [[S1]]\n\nEjemplo ilustrativo: $VAN = 10$.";
      const events = [
        { type: "status", text: "Consultando el material…" },
        { type: "delta", text: "El VAN descuenta los flujos futuros." },
        {
          type: "done",
          reply,
          citations: [
            {
              source_id: "S1",
              material_id: materialId,
              title: material.title,
              page: 1,
              version: 1,
            },
          ],
          activities: [],
          message_id: "reply",
        },
      ];
      return route.fulfill({
        contentType: "text/event-stream",
        body: events
          .map((event) => `data: ${JSON.stringify(event)}\n\n`)
          .join(""),
      });
    }
    if (path.endsWith("/courses")) return route.fulfill({ json: [course] });
    return route.fulfill({
      status: 404,
      json: { detail: "Missing test route" },
    });
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Pensar. Preguntar. Comprender." }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Materiales$/ }).click();
  await page.getByLabel("Título", { exact: true }).fill(material.title);
  await page.getByLabel("Tipo de material").selectOption("syllabus");
  await page.locator("input[type=file]").setInputFiles({
    name: "syllabus.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.7 test fixture"),
  });
  await page.getByRole("button", { name: /Añadir material/ }).click();
  await expect(page.locator(".material-status")).toHaveText(
    "Listo para consultar",
  );
  await page.getByRole("button", { name: /Mapa del curso$/ }).click();
  await page
    .getByLabel("Preparar mapa desde un sílabo")
    .selectOption(materialId);
  await expect(page.getByLabel("Unidad o tema")).toHaveValue(units[0].title);
  await page.getByLabel("Objetivo de aprendizaje").fill("Interpretar el VAN");
  await page.getByRole("button", { name: /Confirmar mapa/ }).click();
  await expect(page.getByText(/Mapa confirmado/)).toBeVisible();
  await page.getByRole("button", { name: /Conversación$/ }).click();
  await page
    .getByLabel("Tu pregunta al tutor")
    .fill("¿Cómo se interpreta el VAN?");
  await page.getByRole("button", { name: "Preguntar →" }).click();
  await expect(
    page.locator(".message.assistant .citations button"),
  ).toContainText("p. 1");
  await expect(
    page.getByRole("button", { name: "Preguntar →" }),
  ).toBeDisabled();
  await expect(page.locator(".katex")).toBeVisible();
  await page.screenshot({
    path: `docs/screenshots/chat-${testInfo.project.name}.png`,
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: /Mi progreso$/ }).click();
  await expect(page.locator(".activity")).toContainText(
    "Revisó el significado del VAN",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
