import { config } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { ListConversationMessages } from "./application/list-conversation-messages.js";
import { PostConversationMessage } from "./application/post-conversation-message.js";
import { RequestBookUpload } from "./application/request-book-upload.js";
import { HttpAgentRuntime } from "./infrastructure/agentcore/http-agent-runtime.js";
import { CognitoAccessTokenVerifier } from "./infrastructure/auth/cognito-jwt-verifier.js";
import { createApp } from "./infrastructure/http/create-app.js";
import { InMemoryConversationStore } from "./infrastructure/memory/in-memory-conversation-store.js";
import { S3IncomingObjectStore } from "./infrastructure/s3/s3-incoming-object-store.js";

const here = dirname(fileURLToPath(import.meta.url));
const backendRoot = join(here, "..");

config({ path: join(backendRoot, ".env") });

const userPoolId = process.env.COGNITO_USER_POOL_ID ?? "";
const clientId = process.env.COGNITO_CLIENT_ID ?? "";
if (!userPoolId || !clientId) {
  throw new Error("COGNITO_USER_POOL_ID and COGNITO_CLIENT_ID are required");
}

const booksBucket = process.env.BOOKS_BUCKET ?? "";
if (!booksBucket) {
  throw new Error("BOOKS_BUCKET is required");
}

const runtime = new HttpAgentRuntime(
  process.env.AGENTCORE_URL ?? "http://127.0.0.1:8080/invocations",
);
const store = new InMemoryConversationStore();

const app = createApp(
  new PostConversationMessage(runtime, store),
  new ListConversationMessages(store),
  new RequestBookUpload(new S3IncomingObjectStore(booksBucket)),
  CognitoAccessTokenVerifier.fromEnv(userPoolId, clientId),
);
const port = Number.parseInt(process.env.PORT ?? "8000", 10);

app.listen(port, "127.0.0.1", () => {
  console.log(`finantutor backend http://127.0.0.1:${port}`);
});
