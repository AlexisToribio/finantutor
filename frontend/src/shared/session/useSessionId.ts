import { useCallback, useEffect, useState } from "react";

type SessionStorage = Pick<Storage, "getItem" | "setItem">;

function storageKey(userId: string): string {
  return `finantutor.session.${userId}`;
}

function readOrCreate(userId: string): string {
  if (!userId) {
    return "";
  }
  const existing = localStorage.getItem(storageKey(userId));
  if (existing) {
    return existing;
  }
  const created = crypto.randomUUID();
  localStorage.setItem(storageKey(userId), created);
  return created;
}

export function startNewSession(
  userId: string,
  storage: SessionStorage = localStorage,
  createId: () => string = () => crypto.randomUUID(),
): string {
  if (!userId) {
    return "";
  }
  const sessionId = createId();
  storage.setItem(storageKey(userId), sessionId);
  return sessionId;
}

export function useSessionId(userId: string) {
  const [sessionId, setSessionId] = useState(() => readOrCreate(userId));

  useEffect(() => {
    setSessionId(readOrCreate(userId));
  }, [userId]);

  const startNewConversation = useCallback(() => {
    setSessionId(startNewSession(userId));
  }, [userId]);

  return { sessionId, startNewConversation };
}
