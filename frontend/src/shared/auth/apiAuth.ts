let getAccessToken: () => Promise<string | null> = async () => null;
let onUnauthorized: () => void = () => {};

export function bindApiAuth(options: {
  getAccessToken: () => Promise<string | null>;
  onUnauthorized: () => void;
}): void {
  getAccessToken = options.getAccessToken;
  onUnauthorized = options.onUnauthorized;
}

export async function authHeaders(): Promise<HeadersInit> {
  const token = await getAccessToken();
  if (!token) {
    return {};
  }
  const bearer = `Bearer ${token}`;
  // X-Authorization survives CloudFront OAC, which replaces Authorization with SigV4.
  return { Authorization: bearer, "X-Authorization": bearer };
}

export function notifyUnauthorized(): void {
  onUnauthorized();
}
