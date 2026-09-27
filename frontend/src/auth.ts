import { Amplify } from "aws-amplify";
import {
  signIn,
  signOut,
  getCurrentUser,
  fetchAuthSession,
  confirmSignIn,
} from "aws-amplify/auth";
export const local = import.meta.env.VITE_AUTH_MODE === "local";
if (!local)
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
        userPoolClientId: import.meta.env.VITE_COGNITO_CLIENT_ID,
      },
    },
  });
export async function currentUser(): Promise<string> {
  return local ? "local-student" : (await getCurrentUser()).userId;
}
export async function token(): Promise<string> {
  if (local) return import.meta.env.VITE_LOCAL_TOKEN;
  const session = await fetchAuthSession();
  if (!session.tokens?.accessToken)
    throw new Error("Tu sesión expiró. Vuelve a iniciar sesión.");
  return session.tokens.accessToken.toString();
}
export async function login(
  username: string,
  password: string,
): Promise<boolean> {
  const result = await signIn({ username, password });
  if (result.isSignedIn) return true;
  if (
    result.nextStep.signInStep === "CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED"
  )
    return false;
  throw new Error(
    "Este flujo de autenticación requiere configuración adicional.",
  );
}
export async function changePassword(password: string): Promise<void> {
  const result = await confirmSignIn({ challengeResponse: password });
  if (!result.isSignedIn)
    throw new Error("No se pudo completar el cambio de contraseña.");
}
export async function logout(): Promise<void> {
  if (!local) await signOut();
}
