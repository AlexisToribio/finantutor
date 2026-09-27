import { CognitoJwtVerifier } from "aws-jwt-verify";
import { timingSafeEqual } from "node:crypto";
import { AppError } from "../domain/contracts.js";
export type Authenticate = (
  authorization: string | undefined,
) => Promise<string>;
export function authentication(): Authenticate {
  if (process.env.AUTH_MODE === "local") {
    if (process.env.AWS_LAMBDA_FUNCTION_NAME)
      throw new Error("Local authentication is forbidden on Lambda");
    const token = process.env.LOCAL_TOKEN;
    if (!token) throw new Error("LOCAL_TOKEN is required in local mode");
    return async (authorization) => {
      const value = authorization?.replace(/^Bearer /, "") ?? "";
      const given = Buffer.from(value),
        expected = Buffer.from(token);
      if (given.length !== expected.length || !timingSafeEqual(given, expected))
        throw new AppError(401, "Inicia sesión para continuar.");
      return "local-student";
    };
  }
  const verifier = CognitoJwtVerifier.create({
    userPoolId: process.env.COGNITO_USER_POOL_ID ?? "",
    clientId: process.env.COGNITO_CLIENT_ID ?? "",
    tokenUse: "access",
  });
  return async (authorization) => {
    try {
      const jwt = await verifier.verify(
        authorization?.replace(/^Bearer /, "") ?? "",
      );
      return jwt.sub;
    } catch {
      throw new AppError(401, "Tu sesión expiró. Vuelve a iniciar sesión.");
    }
  };
}
