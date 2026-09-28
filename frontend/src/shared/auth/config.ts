export type CognitoPublicConfig = {
  userPoolId: string;
  clientId: string;
  region: string;
};

export async function loadCognitoConfig(): Promise<CognitoPublicConfig> {
  try {
    const response = await fetch("/config.json");
    if (response.ok) {
      const body: unknown = await response.json();
      if (
        body &&
        typeof body === "object" &&
        "userPoolId" in body &&
        "clientId" in body &&
        typeof (body as CognitoPublicConfig).userPoolId === "string" &&
        typeof (body as CognitoPublicConfig).clientId === "string"
      ) {
        const config = body as CognitoPublicConfig;
        return {
          userPoolId: config.userPoolId,
          clientId: config.clientId,
          region: config.region || "us-east-1",
        };
      }
    }
  } catch {
    // Local Vite has no config.json; fall through to env.
  }
  const userPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID ?? "";
  const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID ?? "";
  const region = import.meta.env.VITE_COGNITO_REGION ?? "us-east-1";
  if (!userPoolId || !clientId) {
    throw new Error("auth_unavailable");
  }
  return { userPoolId, clientId, region };
}
