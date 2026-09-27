import { resolve } from "node:path";
import { Chat } from "../application/chat.js";
import { authentication } from "./auth.js";
import { SqliteStore, DynamoStore } from "./store.js";
import { LocalFiles, S3Files } from "./files.js";
import { HttpRuntime, AwsRuntime } from "./runtime.js";
export function compose() {
  const region = process.env.AWS_REGION ?? "us-east-1";
  const directory = resolve(process.env.LOCAL_DATA_DIR ?? "../.local");
  const cloud = Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);
  if (
    cloud &&
    (!process.env.APP_TABLE ||
      !process.env.MATERIALS_BUCKET ||
      !process.env.AGENTCORE_RUNTIME_ARN)
  )
    throw new Error("Missing cloud configuration");
  const store = process.env.APP_TABLE
    ? new DynamoStore(process.env.APP_TABLE, region)
    : new SqliteStore(resolve(directory, "app.db"));
  const files = process.env.MATERIALS_BUCKET
    ? new S3Files(process.env.MATERIALS_BUCKET, region)
    : new LocalFiles(
        directory,
        resolve(process.env.INGEST_PYTHON ?? "../ingest/.venv/bin/python"),
        store,
      );
  const runtime = process.env.AGENTCORE_RUNTIME_ARN
    ? new AwsRuntime(process.env.AGENTCORE_RUNTIME_ARN, region)
    : new HttpRuntime(process.env.AGENTCORE_URL ?? "http://127.0.0.1:8080");
  return {
    store,
    files,
    chat: new Chat(store, runtime),
    authenticate: authentication(),
  };
}
