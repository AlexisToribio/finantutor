export const PRESIGN_EXPIRES_SECONDS = 15 * 60;
export const MAX_PDF_BYTES = 50 * 1024 * 1024;
export const COURSE_NAME = "Modelos financieros y evaluación de proyectos";

export class InvalidUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidUploadError";
  }
}

export type BookUploadInput = {
  userId: string;
  filename: string;
  title: string;
};

export type BookUploadResult = {
  uploadUrl: string;
  method: "PUT";
  headers: { "Content-Type": string };
  objectKey: string;
  expiresIn: number;
};

export type IncomingObjectStore = {
  putJson(key: string, body: Record<string, unknown>): Promise<void>;
  presignPut(key: string, contentType: string, expiresIn: number): Promise<string>;
};

export class RequestBookUpload {
  constructor(
    private readonly store: IncomingObjectStore,
    private readonly newId: () => string = () => crypto.randomUUID(),
  ) {}

  async execute(input: BookUploadInput): Promise<BookUploadResult> {
    const userId = input.userId.trim();
    if (!userId) {
      throw new InvalidUploadError("user_id is required");
    }
    const filename = input.filename.trim() || "book.pdf";
    if (!filename.toLowerCase().endsWith(".pdf")) {
      throw new InvalidUploadError("Upload a PDF file");
    }
    const title = input.title.trim();
    if (!title) {
      throw new InvalidUploadError("Title is required");
    }
    const id = this.newId();
    const prefix = `incoming/${userId}/${id}`;
    const objectKey = `${prefix}.pdf`;
    await this.store.putJson(`${prefix}.json`, {
      filename,
      title,
      subject: COURSE_NAME,
      user_id: userId,
    });
    const uploadUrl = await this.store.presignPut(
      objectKey,
      "application/pdf",
      PRESIGN_EXPIRES_SECONDS,
    );
    return {
      uploadUrl,
      method: "PUT",
      headers: { "Content-Type": "application/pdf" },
      objectKey,
      expiresIn: PRESIGN_EXPIRES_SECONDS,
    };
  }
}
