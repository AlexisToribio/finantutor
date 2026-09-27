import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  AppError,
  coursePartition,
  type Files,
  type Material,
  type Store,
} from "../domain/contracts.js";
const run = promisify(execFile);
export class LocalFiles implements Files {
  private tokens = new Map<string, { material: Material; expires: number }>();
  constructor(
    readonly directory: string,
    private python: string,
    private store: Store,
  ) {}
  async upload(material: Material) {
    const token = randomBytes(32).toString("hex");
    for (const [key, value] of this.tokens)
      if (value.expires < Date.now()) this.tokens.delete(key);
    this.tokens.set(token, { material, expires: Date.now() + 600000 });
    return {
      url: `/api/v1/uploads/${token}`,
      headers: { "content-type": "application/pdf" },
    };
  }
  async receive(token: string, data: Buffer): Promise<void> {
    const upload = this.tokens.get(token);
    if (!upload || upload.expires < Date.now())
      throw new AppError(403, "La URL de carga expiró.");
    this.tokens.delete(token);
    const m = upload.material,
      pk = coursePartition(m.owner_id, m.course_id),
      sk = `material#${m.id}`;
    const path = resolve(this.directory, "raw", `${m.id}.pdf`);
    await mkdir(resolve(this.directory, "raw"), { recursive: true });
    await writeFile(path, data, { flag: "wx" });
    await this.store.put(pk, sk, { ...m, status: "indexing" });
    // Work is asynchronous; status is persisted and the UI polls the catalogue.
    void run(
      this.python,
      [
        "-m",
        "finantutor_ingest.cli",
        "--file",
        path,
        "--metadata",
        JSON.stringify(m),
        "--directory",
        this.directory,
      ],
      { maxBuffer: 256000, timeout: 120000 },
    )
      .then(async ({ stdout }) => {
        await this.store.put(pk, sk, {
          ...m,
          ...JSON.parse(stdout),
          status: "ready",
        });
      })
      .catch(async (error: unknown) => {
        console.error(
          "local_ingest_failed",
          error instanceof Error ? error.message.slice(0, 300) : "unknown",
        );
        await this.store.put(pk, sk, {
          ...m,
          status: "failed",
          error:
            "No se pudo leer el PDF. Revisa que tenga texto seleccionable y que no esté protegido.",
        });
      });
  }
  async source(material: Material) {
    return resolve(this.directory, "raw", `${material.id}.pdf`);
  }
}
export class S3Files implements Files {
  private client: S3Client;
  constructor(
    private bucket: string,
    region: string,
  ) {
    this.client = new S3Client({ region, maxAttempts: 3 });
  }
  async upload(material: Material) {
    return {
      url: await getSignedUrl(
        this.client,
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: material.raw_key,
          ContentType: "application/pdf",
          IfNoneMatch: "*",
        }),
        { expiresIn: 600 },
      ),
      headers: { "content-type": "application/pdf", "if-none-match": "*" },
    };
  }
  async source(material: Material) {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: material.raw_key,
        ResponseContentDisposition: 'inline; filename="material.pdf"',
      }),
      { expiresIn: 300 },
    );
  }
}
