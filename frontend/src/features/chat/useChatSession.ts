import { useEffect, useRef, useState } from "react";

import { listMessages, sendChat, type ConversationHistory, type ConversationMessage } from "../../shared/api/chat";
import { API_AGENT, API_UNAVAILABLE } from "../../shared/api/errors";

export type ChatRole = "teacher" | "agent";

export type ChatTurn = {
  role: ChatRole;
  text: string;
};

export function agentReplyText(text: string): string {
  return text.trim() || API_AGENT;
}

export function turnFromMessage(message: ConversationMessage): ChatTurn {
  if (message.status === "error") {
    return { role: message.role, text: API_AGENT };
  }
  const text = message.role === "agent" ? agentReplyText(message.body) : message.body;
  return { role: message.role, text };
}

async function recoverStoredTurn(sessionId: string): Promise<ConversationHistory | null> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 4000));
    try {
      const history = await listMessages(sessionId);
      const last = history.messages.at(-1);
      if (last?.role === "agent" && last.status === "ok" && last.body) {
        return history;
      }
    } catch {
      continue;
    }
  }
  return null;
}

export function useChatSession(sessionId: string) {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [statusText, setStatusText] = useState("El tutor está preparando una respuesta…");
  const [hydrating, setHydrating] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setHydrating(true);
    setError(null);
    void listMessages(sessionId)
      .then((history) => {
        if (cancelled) {
          return;
        }
        setTurns(history.messages.map(turnFromMessage));
      })
      .catch((cause) => {
        if (cancelled) {
          return;
        }
        const message =
          cause instanceof Error ? cause.message : API_UNAVAILABLE;
        setError(message);
        setTurns([]);
      })
      .finally(() => {
        if (!cancelled) {
          setHydrating(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, pending]);

  async function send() {
    const prompt = draft.trim();
    if (!prompt || pending) {
      return;
    }
    setDraft("");
    setError(null);
    setTurns((current) => [...current, { role: "teacher", text: prompt }]);
    setStatusText("El tutor está preparando una respuesta…");
    setPending(true);
    try {
      const result = await sendChat(prompt, sessionId, setStatusText);
      const reply = agentReplyText(result.reply ?? "");
      setTurns((current) => [
        ...current,
        { role: "agent", text: reply },
      ]);
    } catch (cause) {
      const recovered = await recoverStoredTurn(sessionId);
      if (recovered) {
        setTurns(recovered.messages.map(turnFromMessage));
        setError(null);
        return;
      }
      const message =
        cause instanceof Error ? cause.message : API_UNAVAILABLE;
      setError(message);
    } finally {
      setPending(false);
    }
  }

  return {
    turns,
    draft,
    setDraft,
    pending,
    statusText,
    hydrating,
    error,
    endRef,
    send,
  };
}
