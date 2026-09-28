import { useEffect, useState } from "react";

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

export function useSessionId(userId: string): string {
  const [sessionId, setSessionId] = useState(() => readOrCreate(userId));

  useEffect(() => {
    setSessionId(readOrCreate(userId));
  }, [userId]);

  return sessionId;
}
