import serverless from "serverless-http";
import { compose } from "./infrastructure/composition.js";
import { createApp } from "./infrastructure/app.js";
import { chatInput } from "./application/chat.js";
import { AppError } from "./domain/contracts.js";
import { ZodError } from "zod";

declare const awslambda: {
  streamifyResponse: (
    handler: (event: any, stream: any, context: any) => Promise<void>,
  ) => unknown;
  HttpResponseStream: { from: (stream: any, metadata: object) => any };
};
const dependencies = compose();
const buffered = serverless(createApp(dependencies));
export const handler = awslambda.streamifyResponse(
  async (event, rawStream, context) => {
    const match =
      /^\/api\/v1\/courses\/([^/]+)\/conversations\/([^/]+)\/messages$/.exec(
        event.rawPath ?? "",
      );
    if (event.requestContext?.http?.method !== "POST" || !match) {
      const result = (await buffered(event, context)) as {
        statusCode: number;
        headers: object;
        body: string;
        isBase64Encoded?: boolean;
      };
      const stream = awslambda.HttpResponseStream.from(rawStream, {
        statusCode: result.statusCode,
        headers: result.headers,
      });
      stream.end(
        result.isBase64Encoded
          ? Buffer.from(result.body, "base64")
          : result.body,
      );
      return;
    }
    let stream: any;
    try {
      const owner = await dependencies.authenticate(
        event.headers?.["x-authorization"] ?? event.headers?.authorization,
      );
      const body = event.isBase64Encoded
        ? Buffer.from(event.body ?? "", "base64").toString()
        : (event.body ?? "");
      const input = chatInput.parse(JSON.parse(body));
      for await (const item of dependencies.chat.execute(
        owner,
        match[1],
        match[2],
        input,
      )) {
        stream ??= awslambda.HttpResponseStream.from(rawStream, {
          statusCode: 200,
          headers: {
            "content-type": "text/event-stream; charset=utf-8",
            "cache-control": "no-cache, no-transform",
          },
        });
        stream.write(`data: ${JSON.stringify(item)}\n\n`);
      }
      stream?.end();
    } catch (error) {
      console.error(
        "stream_failure",
        error instanceof Error ? error.message : "unknown",
      );
      if (stream) {
        stream.write(
          `data: ${JSON.stringify({ type: "error", message: "No se pudo completar la respuesta." })}\n\n`,
        );
        stream.end();
      } else {
        const status =
          error instanceof AppError
            ? error.status
            : error instanceof ZodError || error instanceof SyntaxError
              ? 422
              : 502;
        stream = awslambda.HttpResponseStream.from(rawStream, {
          statusCode: status,
          headers: { "content-type": "application/json" },
        });
        stream.end(
          JSON.stringify({
            detail:
              error instanceof AppError
                ? error.message
                : "No se pudo completar la solicitud.",
          }),
        );
      }
    }
  },
);
