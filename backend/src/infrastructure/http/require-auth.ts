import type { NextFunction, Request, Response } from "express";

import {
  UnauthorizedError,
  type TokenVerifier,
} from "../../domain/ports/token-verifier.js";
import { errorMessage, errorName, logger } from "../observability/logger.js";

export type AuthedRequest = Request & { userId: string };

export type AuthTokenSource = "x-authorization" | "authorization" | "none";

function bearerToken(header: string | undefined): string | null {
  if (!header) {
    return null;
  }
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return null;
  }
  return token;
}

export function authTokenSource(req: Request): AuthTokenSource {
  if (bearerToken(req.header("x-authorization"))) {
    return "x-authorization";
  }
  if (bearerToken(req.header("authorization"))) {
    return "authorization";
  }
  return "none";
}

export function requireAuth(verifier: TokenVerifier) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const tokenSource = authTokenSource(req);
    const token =
      bearerToken(req.header("x-authorization")) ??
      bearerToken(req.header("authorization"));
    if (!token) {
      logger.error("auth.rejected", {
        method: req.method,
        path: req.path,
        token_source: tokenSource,
        reason: "missing_bearer",
      });
      res.status(401).json({ detail: "Unauthorized" });
      return;
    }
    try {
      const user = await verifier.verify(token);
      (req as AuthedRequest).userId = user.userId;
      logger.info("auth.ok", {
        method: req.method,
        path: req.path,
        token_source: tokenSource,
        user_id: user.userId,
      });
      next();
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        logger.error("auth.rejected", {
          method: req.method,
          path: req.path,
          token_source: tokenSource,
          reason: "invalid_token",
          error_name: errorName(error),
          error: errorMessage(error),
        });
        res.status(401).json({ detail: "Unauthorized" });
        return;
      }
      next(error);
    }
  };
}

export function userIdOf(req: Request): string {
  const userId = (req as AuthedRequest).userId;
  if (!userId) {
    throw new UnauthorizedError();
  }
  return userId;
}
