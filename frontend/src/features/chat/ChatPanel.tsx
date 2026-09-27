import type { FormEvent, RefObject } from "react";
import Markdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { openSource, type Citation, type Material, type Message } from "../../api";

type Props = {
  courseId: string;
  title: string;
  messages: Message[];
  materials: Material[];
  prompt: string;
  setPrompt: (value: string) => void;
  busy: boolean;
  status: string;
  onSend: (event: FormEvent) => void;
  onNewConversation: () => void;
  onError: (message: string) => void;
  bottom: RefObject<HTMLDivElement | null>;
};

export function ChatPanel({
  courseId, title, messages, materials, prompt, setPrompt, busy, status,
  onSend, onNewConversation, onError, bottom,
}: Props) {
  return (
    <section className="chat-section">
      <div className="chat-toolbar">
        <span>{title}</span>
        <button className="text-button" disabled={busy} onClick={onNewConversation}>
          Nueva conversación ↗
        </button>
      </div>
      <div className="messages" aria-label="Conversación con el tutor">
        {!messages.length && (
          <div className="welcome">
            <div className="tutor-seal">ƒ</div>
            <h2>Empecemos por lo que<br />quieres entender.</h2>
            <p>Podemos desarrollar una idea, practicar un caso o revisar tus pasos. Comparte los datos y el contexto que tengas.</p>
            <div className="starters">
              {["¿Cómo se interpreta el VAN?", "Ayúdame a revisar mi procedimiento", "Quiero practicar con un caso"].map((text) => (
                <button key={text} onClick={() => setPrompt(text)}>{text}<span>↗</span></button>
              ))}
            </div>
            {!materials.some((material) => material.status === "ready") && (
              <p className="source-note">Añade el sílabo o la teoría en Sílabo y materiales para trabajar con las fuentes del curso.</p>
            )}
          </div>
        )}
        {messages.map((message) => (
          <article key={message.id} className={`message ${message.role} ${message.failed ? "failed" : ""}`}>
            <span className="message-author">{message.role === "user" ? "TÚ" : "TUTOR"}{message.pending ? " · elaborando respuesta" : ""}</span>
            <div className="markdown">
              <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]} components={{
                a: ({ href, children }) => <a href={href?.startsWith("https://") ? href : undefined} target="_blank" rel="noopener noreferrer">{children}</a>,
              }}>{message.body || "Pensando en tu pregunta…"}</Markdown>
            </div>
            {Boolean(message.citations?.length) && (
              <div className="citations">
                <span>MATERIALES CONSULTADOS</span>
                {message.citations?.map((citation: Citation) => (
                  <button key={citation.source_id} onClick={() => void openSource(courseId, citation).catch((error) => onError(error.message))}>
                    [{citation.source_id}] {citation.title}{citation.page ? ` · p. ${citation.page}` : ""} ↗
                  </button>
                ))}
              </div>
            )}
            {message.failed && <p className="source-note">Respuesta incompleta; puedes enviar de nuevo tu pregunta.</p>}
          </article>
        ))}
        {busy && <p className="thinking" role="status">{status || "Preparando una explicación…"}</p>}
        <div ref={bottom} />
      </div>
      <form className="composer" onSubmit={onSend}>
        <label className="sr-only" htmlFor="prompt">Tu pregunta al tutor</label>
        <textarea id="prompt" value={prompt} maxLength={12000} onChange={(event) => setPrompt(event.target.value)} placeholder="Escribe una pregunta o comparte tu procedimiento…" rows={3} disabled={busy} />
        <div className="composer-bottom">
          <span className="composer-hint">Respuestas guiadas por tus materiales</span>
          <button className="primary" disabled={busy || !prompt.trim()}>{busy ? "Elaborando…" : "Preguntar →"}</button>
        </div>
      </form>
      <p className="fine-print">Comprueba los supuestos y consulta las fuentes. El tutor acompaña tu aprendizaje.</p>
    </section>
  );
}
