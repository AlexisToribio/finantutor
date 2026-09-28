import { CognitoJwtVerifier } from "aws-jwt-verify";

import {
  UnauthorizedError,
  type AuthUser,
  type TokenVerifier,
} from "../../domain/ports/token-verifier.js";

export class CognitoAccessTokenVerifier implements TokenVerifier {
  constructor(
    private readonly verifier: {
      verify(token: string): Promise<{ sub?: string }>;
    },
  ) {}

  static fromEnv(userPoolId: string, clientId: string): CognitoAccessTokenVerifier {
    return new CognitoAccessTokenVerifier(
      CognitoJwtVerifier.create({
        userPoolId,
        tokenUse: "access",
        clientId,
      }),
    );
  }

  async verify(accessToken: string): Promise<AuthUser> {
    try {
      const payload = await this.verifier.verify(accessToken);
      const userId = payload.sub?.trim();
      if (!userId) {
        throw new UnauthorizedError();
      }
      return { userId };
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        throw error;
      }
      throw new UnauthorizedError();
    }
  }
}
