import { type FormEvent, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { confirmSignIn, signIn } from "aws-amplify/auth";

import { CuadernoShell } from "../../app/layout/CuadernoShell";
import { useAuth } from "../../shared/auth/AuthProvider";
import { AUTH_EXTRA_STEP, AUTH_UNAVAILABLE, toLoginError } from "../../shared/auth/messages";
import { PasswordField } from "./PasswordField";

export function LoginPage() {
  const { status, error: authError, refresh } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const from = params.get("from") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [needNewPassword, setNeedNewPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const blocked = Boolean(authError);

  useEffect(() => {
    if (status === "signedIn") {
      navigate(from.startsWith("/") ? from : "/", { replace: true });
    }
  }, [status, from, navigate]);

  async function finishLogin() {
    await refresh();
    navigate(from.startsWith("/") ? from : "/", { replace: true });
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending || blocked) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      if (needNewPassword) {
        const confirmed = await confirmSignIn({ challengeResponse: newPassword });
        if (confirmed.isSignedIn) {
          await finishLogin();
        } else {
          setError(AUTH_EXTRA_STEP);
        }
        return;
      }
      const result = await signIn({ username: email.trim(), password });
      if (result.isSignedIn) {
        await finishLogin();
        return;
      }
      if (result.nextStep.signInStep === "CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED") {
        setNeedNewPassword(true);
        return;
      }
      setError(AUTH_EXTRA_STEP);
    } catch (cause) {
      setError(toLoginError(cause));
    } finally {
      setPending(false);
    }
  }

  if (status === "loading" || status === "signedIn") {
    return (
      <p className="auth-loading" role="status">
        Abriendo el cuaderno…
      </p>
    );
  }

  return (
    <CuadernoShell>
      <section className="panel login-panel" aria-labelledby="login-heading">
        <header className="panel-head">
          <div>
              <h2 id="login-heading">Inicia sesión</h2>
              <p className="lede">
              Accede al tutor y a los materiales de tu curso.
            </p>
          </div>
        </header>
        <form className="login-form" onSubmit={onSubmit}>
          {needNewPassword ? (
            <>
              <PasswordField
                id="new-password"
                label="Nueva contraseña"
                autoComplete="new-password"
                value={newPassword}
                onChange={setNewPassword}
                required
                minLength={8}
                disabled={blocked}
              />
              <p className="lede">
                Te llegó una clave temporal al correo. Elige una permanente:
                mayúscula, número y símbolo.
              </p>
            </>
          ) : (
            <>
              <label htmlFor="email">Correo</label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                disabled={blocked}
              />
              <PasswordField
                id="password"
                label="Contraseña"
                autoComplete="current-password"
                value={password}
                onChange={setPassword}
                required
                disabled={blocked}
              />
            </>
          )}
          {error || authError ? (
            <p className="banner error" role="alert">
              {error || AUTH_UNAVAILABLE}
            </p>
          ) : null}
          <button type="submit" className="primary" disabled={pending || blocked}>
            {needNewPassword ? "Guardar y entrar" : "Entrar"}
          </button>
        </form>
      </section>
    </CuadernoShell>
  );
}
