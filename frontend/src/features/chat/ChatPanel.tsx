import { lazy, Suspense, type FormEvent } from "react";

import { useChatSession } from "./useChatSession";

const AgentMarkdown = lazy(async () => {
  const module = await import("./AgentMarkdown");
  return { default: module.AgentMarkdown };
});

type Props = {
  sessionId: string;
  onNewConversation: () => void;
};

export function ChatPanel({ sessionId, onNewConversation }: Props) {
  const {
    turns,
    draft,
    setDraft,
    pending,
    statusText,
    hydrating,
    error,
    endRef,
    send,
  } = useChatSession(sessionId);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void send();
  }

  return (
    <section className="panel chat-panel" aria-labelledby="chat-heading">
      <header className="panel-head">
        <div>
          <h2 id="chat-heading">Conversación</h2>
          <p className="lede">
            Consulta los conceptos del curso y profundiza en los materiales.
          </p>
        </div>
        <button
          type="button"
          className="ghost"
          disabled={hydrating || pending}
          onClick={onNewConversation}
        >
          Nueva conversación
        </button>
      </header>

      <div className="thread" role="log" aria-live="polite">
        {hydrating ? (
          <p className="empty-line">Cargando la conversación…</p>
        ) : turns.length === 0 && !pending ? (
          <div className="empty-state">
            <span className="empty-mark" aria-hidden="true">∑</span>
            <p>¿Qué concepto financiero quieres entender mejor?</p>
            <span>Pregunta sobre flujos de caja, VAN, TIR o evaluación de proyectos.</span>
          </div>
        ) : null}
        {turns.map((turn, index) => (
          <article
            key={`${turn.role}-${index}`}
            className={turn.role === "teacher" ? "bubble teacher" : "bubble agent"}
          >
            <span className="who">
              {turn.role === "teacher" ? "Tú" : "Tutor"}
            </span>
            {turn.role === "agent" ? (
              <Suspense fallback={<p>…</p>}>
                <AgentMarkdown text={turn.text} />
              </Suspense>
            ) : (
              <p>{turn.text}</p>
            )}
          </article>
        ))}
        {pending ? (
          <p className="bubble agent pending">{statusText}</p>
        ) : null}
        <div ref={endRef} />
      </div>

      {error ? (
        <p className="banner error" role="alert">
          {error}
        </p>
      ) : null}

      <form className="composer" onSubmit={onSubmit}>
        <label className="sr-only" htmlFor="prompt">
          Mensaje
        </label>
        <textarea
          id="prompt"
          rows={3}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Escribe tu pregunta sobre el curso…"
          disabled={pending}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void send();
            }
          }}
        />
        <button type="submit" className="primary" disabled={pending || !draft.trim()}>
          Consultar
        </button>
      </form>
    </section>
  );
}
