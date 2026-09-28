import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { Amplify } from "aws-amplify";
import {
  fetchAuthSession,
  getCurrentUser,
  signOut as amplifySignOut,
} from "aws-amplify/auth";
import { cognitoUserPoolsTokenProvider } from "aws-amplify/auth/cognito";

import { bindApiAuth } from "./apiAuth";
import { loadCognitoConfig } from "./config";
import { AUTH_SESSION, AUTH_UNAVAILABLE } from "./messages";

type AuthStatus = "loading" | "signedOut" | "signedIn";

type AuthValue = {
  status: AuthStatus;
  userId: string | null;
  email: string | null;
  error: string | null;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

const SESSION_DEADLINE_KEY = "finantutor.auth.expiresAt";

const sessionStorageAdapter = {
  async setItem(key: string, value: string) {
    sessionStorage.setItem(key, value);
  },
  async getItem(key: string) {
    return sessionStorage.getItem(key);
  },
  async removeItem(key: string) {
    sessionStorage.removeItem(key);
  },
  async clear() {
    sessionStorage.clear();
  },
};

function tokenExpiryMs(access: { payload: { exp?: unknown } }): number {
  const exp = access.payload.exp;
  return typeof exp === "number" ? exp * 1000 : Date.now() + 60 * 60 * 1000;
}

async function readAccessToken(): Promise<string | null> {
  const session = await fetchAuthSession({ forceRefresh: false });
  const access = session.tokens?.accessToken;
  if (!access) {
    return null;
  }
  if (tokenExpiryMs(access) <= Date.now()) {
    return null;
  }
  return access.toString();
}

async function readSession(): Promise<{
  userId: string;
  email: string | null;
  expMs: number;
} | null> {
  const session = await fetchAuthSession({ forceRefresh: false });
  const access = session.tokens?.accessToken;
  if (!access) {
    return null;
  }
  const userId = access.payload.sub;
  if (typeof userId !== "string" || !userId) {
    return null;
  }
  const expMs = tokenExpiryMs(access);
  if (expMs <= Date.now()) {
    return null;
  }
  let email: string | null = null;
  try {
    const current = await getCurrentUser();
    email = current.signInDetails?.loginId ?? current.username ?? null;
  } catch {
    email = null;
  }
  return { userId, email, expMs };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const expiryTimer = useRef<number | null>(null);

  const clearExpiryTimer = useCallback(() => {
    if (expiryTimer.current !== null) {
      window.clearTimeout(expiryTimer.current);
      expiryTimer.current = null;
    }
  }, []);

  const signOut = useCallback(async () => {
    clearExpiryTimer();
    try {
      await amplifySignOut();
    } catch {
      // Already signed out.
    }
    sessionStorage.removeItem(SESSION_DEADLINE_KEY);
    setUserId(null);
    setEmail(null);
    setStatus("signedOut");
  }, [clearExpiryTimer]);

  const applySession = useCallback(
    async (session: Awaited<ReturnType<typeof readSession>>) => {
      clearExpiryTimer();
      if (!session) {
        sessionStorage.removeItem(SESSION_DEADLINE_KEY);
        setUserId(null);
        setEmail(null);
        setStatus("signedOut");
        return;
      }
      sessionStorage.setItem(SESSION_DEADLINE_KEY, String(session.expMs));
      setUserId(session.userId);
      setEmail(session.email);
      setStatus("signedIn");
      const wait = Math.max(session.expMs - Date.now(), 0);
      expiryTimer.current = window.setTimeout(() => {
        void signOut();
      }, wait);
    },
    [clearExpiryTimer, signOut],
  );

  const refresh = useCallback(async () => {
    setError(null);
    try {
      await applySession(await readSession());
    } catch (cause) {
      console.error(cause);
      setError(AUTH_SESSION);
      await applySession(null);
    }
  }, [applySession]);

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      try {
        const config = await loadCognitoConfig();
        cognitoUserPoolsTokenProvider.setKeyValueStorage(sessionStorageAdapter);
        Amplify.configure({
          Auth: {
            Cognito: {
              userPoolId: config.userPoolId,
              userPoolClientId: config.clientId,
              loginWith: { email: true },
            },
          },
        });
        bindApiAuth({
          getAccessToken: readAccessToken,
          onUnauthorized: () => {
            void signOut();
          },
        });
        if (!cancelled) {
          await refresh();
        }
      } catch (cause) {
        if (!cancelled) {
          console.error(cause);
          setError(AUTH_UNAVAILABLE);
          setStatus("signedOut");
        }
      }
    }
    void boot();
    return () => {
      cancelled = true;
      clearExpiryTimer();
    };
    // Boot once; signOut/refresh are stable enough for the session timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(
    () => ({ status, userId, email, error, signOut, refresh }),
    [status, userId, email, error, signOut, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return value;
}
