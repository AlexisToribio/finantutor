import cors from "cors";
import express, { type Express } from "express";

import { ListConversationMessages } from "../../application/list-conversation-messages.js";
import {
  AGENT_UNAVAILABLE,
  PostConversationMessage,
} from "../../application/post-conversation-message.js";
import {
  InvalidUploadError,
  RequestBookUpload,
} from "../../application/request-book-upload.js";
import type { StoredConversationMessage } from "../../domain/ports/conversation-store.js";
import type { TokenVerifier } from "../../domain/ports/token-verifier.js";
import { errorMessage, errorName, logger } from "../observability/logger.js";
import { authTokenSource, requireAuth, userIdOf } from "./require-auth.js";

function jsonMessage(message: StoredConversationMessage) {
  return {
    id: message.id,
    role: message.role,
    event: message.event,
    body: message.status === "error" ? AGENT_UNAVAILABLE : message.body,
    created_at: message.createdAt,
    author: message.author,
    schema_version: message.schemaVersion,
    status: message.status,
  };
}

function pathParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

export function createApp(
  postMessage: PostConversationMessage,
  listMessages: ListConversationMessages,
  books: RequestBookUpload,
  verifier: TokenVerifier,
): Express {
  const app = express();
  app.use(
    cors({
      origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Authorization",
        "X-Amz-Content-Sha256",
      ],
    }),
  );
  app.use(express.json());
  app.use((req, res, next) => {
    const started = Date.now();
    logger.info("http.received", {
      method: req.method,
      path: req.path,
      token_source: authTokenSource(req),
    });
    res.on("finish", () => {
      logger.info("http.responded", {
        method: req.method,
        path: req.path,
        status: res.statusCode,
        ms: Date.now() - started,
      });
    });
    next();
  });

  app.get("/api/v1/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  const auth = requireAuth(verifier);

  app.get("/api/v1/conversations/:sessionId/messages", auth, async (req, res) => {
    const sessionId = pathParam(req.params.sessionId);
    const userId = userIdOf(req);
    logger.info("chat.list.received", { user_id: userId, session_id: sessionId });
    try {
      const messages = await listMessages.execute(userId, sessionId);
      logger.info("chat.list.responded", {
        user_id: userId,
        session_id: sessionId,
        message_count: messages.length,
      });
      res.json({
        session_id: sessionId,
        messages: messages.map(jsonMessage),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "List failed";
      const status = message === "session_id is required" ? 422 : 502;
      logger.error("chat.list.failed", {
        user_id: userId,
        session_id: sessionId,
        status,
        error_name: errorName(error),
        error: errorMessage(error),
      });
      res.status(status).json({ detail: message });
    }
  });

  app.post("/api/v1/conversations/:sessionId/messages", auth, async (req, res) => {
    const sessionId = pathParam(req.params.sessionId);
    const userId = userIdOf(req);
    const prompt = typeof req.body?.prompt === "string" ? req.body.prompt : "";
    logger.info("chat.post.received", {
      user_id: userId,
      session_id: sessionId,
      prompt_chars: prompt.length,
      prompt_preview: prompt.slice(0, 120),
    });
    let opened = false;
    let clientGone = false;
    res.on("close", () => {
      if (!res.writableEnded) {
        clientGone = true;
      }
    });
    try {
      for await (const event of postMessage.execute(userId, sessionId, prompt)) {
        if (!opened) {
          res.status(200);
          res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
          res.setHeader("Cache-Control", "no-cache, no-transform");
          res.setHeader("X-Accel-Buffering", "no");
          res.flushHeaders();
          opened = true;
        }
        if (!clientGone) {
          res.write(`data: ${JSON.stringify(event)}\n\n`);
        }
        if (event.type === "done") {
          const reply = typeof event.reply === "string" ? event.reply : "";
          logger.info("chat.post.responded", {
            user_id: userId,
            session_id: sessionId,
            reply_chars: reply.length,
          });
        }
      }
      if (!opened) {
        res.status(502).json({ detail: AGENT_UNAVAILABLE });
        return;
      }
      res.end();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Chat failed";
      const status =
        message === "session_id is required" || message === "prompt is required"
          ? 422
          : 502;
      logger.error("chat.post.failed", {
        user_id: userId,
        session_id: sessionId,
        status,
        error_name: errorName(error),
        error: errorMessage(error),
      });
      if (opened || res.headersSent) {
        if (!clientGone) {
          res.write(
            `data: ${JSON.stringify({ type: "error", message: AGENT_UNAVAILABLE })}\n\n`,
          );
          res.end();
        }
        return;
      }
      res.status(status).json({
        detail: status === 422 ? message : AGENT_UNAVAILABLE,
      });
    }
  });

  app.post("/api/v1/books", auth, (_req, res) => {
    res.status(410).json({ detail: "Use POST /api/v1/books/uploads" });
  });

  app.post("/api/v1/books/uploads", auth, async (req, res) => {
    const userId = userIdOf(req);
    const filename = typeof req.body?.filename === "string" ? req.body.filename : "";
    const title = typeof req.body?.title === "string" ? req.body.title : "";
    logger.info("books.uploads.received", {
      user_id: userId,
      filename,
      title,
    });
    try {
      const result = await books.execute({
        userId,
        filename,
        title,
      });
      logger.info("books.uploads.responded", {
        user_id: userId,
        object_key: result.objectKey,
        method: result.method,
        expires_in: result.expiresIn,
        content_type: result.headers["Content-Type"],
      });
      res.json({
        upload_url: result.uploadUrl,
        method: result.method,
        headers: result.headers,
        object_key: result.objectKey,
        expires_in: result.expiresIn,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed";
      const status = error instanceof InvalidUploadError ? 422 : 400;
      logger.error("books.uploads.failed", {
        user_id: userId,
        filename,
        status,
        error_name: errorName(error),
        error: errorMessage(error),
      });
      res.status(status).json({ detail: message });
    }
  });

  return app;
}
