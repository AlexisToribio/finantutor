import { z } from "zod";
export const citationSchema = z.object({
  source_id: z.string().regex(/^S\d+$/),
  material_id: z.uuid(),
  title: z.string().max(200),
  version: z.union([z.string(), z.number()]),
  page: z.number().int().min(1).max(500).nullable().optional(),
});
export const eventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("status"), text: z.string() }),
  z.object({ type: z.literal("heartbeat") }),
  z.object({ type: z.literal("delta"), text: z.string() }),
  z.object({ type: z.literal("error"), message: z.string() }),
  z.object({
    type: z.literal("done"),
    reply: z.string().min(1).max(80000),
    citations: z.array(citationSchema).max(72),
    message_id: z.string().optional(),
  }),
]);
export type AgentEvent = z.infer<typeof eventSchema>;
export type Citation = z.infer<typeof citationSchema>;
export interface Course {
  id: string;
  owner_id: string;
  title: string;
  created_at: string;
}
export interface Material {
  id: string;
  owner_id: string;
  course_id: string;
  title: string;
  filename: string;
  kind: "syllabus" | "theory";
  unit: string;
  version: number;
  raw_key: string;
  status: "uploading" | "uploaded" | "indexing" | "ready" | "failed";
  created_at: string;
  error?: string;
  checksum?: string;
  page_count?: number;
}
export interface Message {
  id: string;
  role: "user" | "assistant";
  body: string;
  created_at: string;
  citations?: Citation[];
}
export interface Store {
  commit(
    writes: Array<{ pk: string; sk: string; value: object }>,
  ): Promise<void>;
  get<T>(pk: string, sk: string): Promise<T | undefined>;
  put(pk: string, sk: string, value: object): Promise<void>;
  list<T>(pk: string, prefix: string): Promise<T[]>;
  acquire(key: string, token: string): Promise<boolean>;
  release(key: string, token: string): Promise<void>;
}
export interface Runtime {
  stream(session: string, payload: object): AsyncIterable<AgentEvent>;
}
export interface Files {
  upload(
    material: Material,
  ): Promise<{ url: string; headers: Record<string, string> }>;
  source(material: Material): Promise<string>;
}
export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const coursePartition = (owner: string, course: string) =>
  `course#${owner}#${course}`;
export const chatPartition = (owner: string, course: string, session: string) =>
  `chat#${owner}#${course}#${session}`;
