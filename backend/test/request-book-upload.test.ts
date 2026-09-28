import { describe, expect, it } from "vitest";

import {
  InvalidUploadError,
  RequestBookUpload,
  type IncomingObjectStore,
} from "../src/application/request-book-upload.js";

class FakeStore implements IncomingObjectStore {
  public json: Array<{ key: string; body: Record<string, unknown> }> = [];
  public puts: string[] = [];

  async putJson(key: string, body: Record<string, unknown>) {
    this.json.push({ key, body });
  }

  async presignPut(key: string) {
    this.puts.push(key);
    return `https://s3.example/${key}`;
  }
}

function useCase(store = new FakeStore()) {
  return {
    store,
    books: new RequestBookUpload(store, () => "uuid-1"),
  };
}

const valid = {
  userId: "teacher-1",
  filename: "fracciones.pdf",
  title: "Mate 3",
};

describe("RequestBookUpload", () => {
  it("writes sidecar json then presigns a namespaced pdf key", async () => {
    const { store, books } = useCase();
    const result = await books.execute(valid);
    expect(result).toEqual({
      uploadUrl: "https://s3.example/incoming/teacher-1/uuid-1.pdf",
      method: "PUT",
      headers: { "Content-Type": "application/pdf" },
      objectKey: "incoming/teacher-1/uuid-1.pdf",
      expiresIn: 900,
    });
    expect(store.json).toEqual([
      {
        key: "incoming/teacher-1/uuid-1.json",
        body: {
          filename: "fracciones.pdf",
          title: "Mate 3",
          subject: "Modelos financieros y evaluación de proyectos",
          user_id: "teacher-1",
        },
      },
    ]);
    expect(store.puts).toEqual(["incoming/teacher-1/uuid-1.pdf"]);
  });

  it("rejects a non-pdf filename", async () => {
    const { store, books } = useCase();
    await expect(
      books.execute({ ...valid, filename: "notas.txt" }),
    ).rejects.toBeInstanceOf(InvalidUploadError);
    expect(store.json).toHaveLength(0);
  });
});
