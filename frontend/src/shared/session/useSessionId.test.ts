import { describe, expect, it } from "vitest";

import { startNewSession } from "./useSessionId";

describe("startNewSession", () => {
  it("persists a fresh session for only the active user", () => {
    const values = new Map([
      ["finantutor.session.student-1", "old-session"],
      ["finantutor.session.student-2", "other-session"],
    ]);
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };

    const sessionId = startNewSession(
      "student-1",
      storage,
      () => "new-session",
    );

    expect(sessionId).toBe("new-session");
    expect(values.get("finantutor.session.student-1")).toBe("new-session");
    expect(values.get("finantutor.session.student-2")).toBe("other-session");
  });
});
