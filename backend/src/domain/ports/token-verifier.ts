export type AuthUser = {
  userId: string;
};

export type TokenVerifier = {
  verify(accessToken: string): Promise<AuthUser>;
};

export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export function userAuthor(userId: string): string {
  return `user:${userId}`;
}
