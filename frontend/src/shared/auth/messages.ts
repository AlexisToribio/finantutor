export const AUTH_UNAVAILABLE =
  "No se puede entrar ahora. Vuelve en un rato o avisa a quien te invitó.";

export const AUTH_CREDENTIALS =
  "Correo o contraseña no coinciden.";

export const AUTH_NETWORK =
  "No hay conexión. Revisa la red e inténtalo otra vez.";

export const AUTH_THROTTLED =
  "Demasiados intentos. Espera un momento y vuelve a probar.";

export const AUTH_PASSWORD_RULES =
  "La contraseña necesita al menos 8 caracteres, con mayúscula, número y símbolo.";

export const AUTH_EXTRA_STEP =
  "Este acceso no se pudo completar. Avisa a quien te invitó.";

export const AUTH_SESSION =
  "La sesión se cerró. Vuelve a entrar.";

function errorName(cause: unknown): string {
  if (cause && typeof cause === "object" && "name" in cause) {
    const name = (cause as { name: unknown }).name;
    if (typeof name === "string") {
      return name;
    }
  }
  return "";
}

function errorText(cause: unknown): string {
  if (cause instanceof Error) {
    return cause.message;
  }
  return "";
}

export function toLoginError(cause: unknown): string {
  const name = errorName(cause);
  const text = errorText(cause).toLowerCase();

  if (
    name === "NotAuthorizedException" ||
    name === "UserNotFoundException" ||
    text.includes("incorrect username or password")
  ) {
    return AUTH_CREDENTIALS;
  }
  if (name === "InvalidPasswordException") {
    return AUTH_PASSWORD_RULES;
  }
  if (
    name === "ResourceNotFoundException" ||
    name === "InvalidUserPoolConfigurationException"
  ) {
    return AUTH_UNAVAILABLE;
  }
  if (
    name === "LimitExceededException" ||
    name === "TooManyRequestsException" ||
    name === "TooManyFailedAttemptsException"
  ) {
    return AUTH_THROTTLED;
  }
  if (
    name === "NetworkError" ||
    text.includes("failed to fetch") ||
    text.includes("network")
  ) {
    return AUTH_NETWORK;
  }
  return AUTH_CREDENTIALS;
}
