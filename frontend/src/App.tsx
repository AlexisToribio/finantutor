import { useEffect, useRef, useState, type FormEvent } from "react";
import Markdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { currentUser, local, login, logout, changePassword } from "./auth";
import {
  request,
  chat,
  openSource,
  type Course,
  type Message,
  type Material,
  type Unit,
  type Activity,
} from "./api";
const DEFAULT_COURSE = "Modelos financieros y evaluación de proyectos";
const modes = [
  ["explain", "Entender un tema"],
  ["practice", "Practicar"],
  ["case", "Resolver un caso"],
  ["review", "Revisar mis pasos"],
];
const statusLabels: Record<string, string> = {
  uploading: "Esperando archivo",
  uploaded: "Cargado",
  indexing: "Preparando material",
  ready: "Listo para consultar",
  failed: "Requiere revisión",
};
const outcomeLabels: Record<string, string> = {
  studied: "Estudiado",
  practiced: "Practicado",
  needs_review: "Por repasar",
};
export default function App() {
  const [user, setUser] = useState<string | null>(null),
    [authLoading, setAuthLoading] = useState(true);
  const [credentials, setCredentials] = useState({
      username: "",
      password: "",
    }),
    [needsPassword, setNeedsPassword] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]),
    [courseId, setCourseId] = useState(""),
    [tab, setTab] = useState("chat");
  const [courseName, setCourseName] = useState(DEFAULT_COURSE),
    [materials, setMaterials] = useState<Material[]>([]),
    [progress, setProgress] = useState<Activity[]>([]);
  const [units, setUnits] = useState<Unit[]>([]),
    [outlineSource, setOutlineSource] = useState<string | undefined>();
  const [messages, setMessages] = useState<Message[]>([]),
    [sessionId, setSessionId] = useState("");
  const [prompt, setPrompt] = useState(""),
    [mode, setMode] = useState("explain"),
    [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [materialTitle, setMaterialTitle] = useState(""),
    [materialKind, setMaterialKind] = useState<"theory" | "syllabus">("theory"),
    [materialUnit, setMaterialUnit] = useState("");
  const controller = useRef<AbortController | null>(null),
    bottom = useRef<HTMLDivElement>(null);
  const selected = courses.find((course) => course.id === courseId);
  const base = `/courses/${courseId}`;
  useEffect(() => {
    currentUser()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setAuthLoading(false));
    return () => controller.current?.abort();
  }, []);
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    request<Course[]>("/courses")
      .then((items) => {
        if (!cancelled) {
          setCourses(items);
          setCourseId(items[0]?.id ?? "");
        }
      })
      .catch((e) => setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [user]);
  useEffect(() => {
    if (!courseId || !user) return;
    const key = `finantutor.session.${user}.${courseId}`;
    const session = localStorage.getItem(key) ?? crypto.randomUUID();
    localStorage.setItem(key, session);
    setSessionId(session);
    let cancelled = false;
    Promise.all([
      request<Material[]>(`${base}/materials`),
      request<Activity[]>(`${base}/progress`),
      request<Message[]>(`${base}/conversations/${session}/messages`),
    ])
      .then(([m, p, h]) => {
        if (!cancelled) {
          setMaterials(m);
          setProgress(p);
          setMessages(h);
        }
      })
      .catch((e) => setError(e.message));
    setUnits(selected?.outline ?? []);
    setOutlineSource(selected?.outline_source);
    setError("");
    setNotice("");
    return () => {
      cancelled = true;
    };
  }, [courseId, user]);
  useEffect(() => {
    const container = bottom.current?.parentElement;
    container?.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  }, [messages, status]);
  const pending = materials.some((material) =>
    ["uploading", "uploaded", "indexing"].includes(material.status),
  );
  useEffect(() => {
    if (!courseId || !pending) return;
    const interval = setInterval(() => {
      request<Material[]>(`${base}/materials`)
        .then(setMaterials)
        .catch((e) => setError(e.message));
    }, 4000);
    return () => clearInterval(interval);
  }, [courseId, pending]);
  async function signIn(event: FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (needsPassword) await changePassword(credentials.password);
      else if (!(await login(credentials.username, credentials.password))) {
        setNeedsPassword(true);
        setCredentials((v) => ({ ...v, password: "" }));
        return;
      }
      setUser(await currentUser());
    } catch {
      setError("No se pudo iniciar sesión. Verifica tu correo y contraseña.");
    } finally {
      setBusy(false);
    }
  }
  async function createCourse(event: FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const course = await request<Course>("/courses", "POST", {
        title: courseName,
      });
      setCourses((value) => [...value, course]);
      setCourseId(course.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function newConversation() {
    if (busy || !user) return;
    const session = crypto.randomUUID();
    localStorage.setItem(`finantutor.session.${user}.${courseId}`, session);
    setSessionId(session);
    setMessages([]);
    setError("");
    setNotice(
      "Conversación nueva. Las actividades anteriores siguen en Progreso.",
    );
  }
  async function send(event: FormEvent) {
    event.preventDefault();
    if (!prompt.trim() || busy || !selected) return;
    const text = prompt.trim(),
      id = crypto.randomUUID();
    setPrompt("");
    setBusy(true);
    setError("");
    setNotice("");
    setMessages((value) => [
      ...value,
      { id: crypto.randomUUID(), role: "user", body: text },
      { id, role: "assistant", body: "", pending: true },
    ]);
    const abort = new AbortController();
    controller.current = abort;
    try {
      await chat(
        `${base}/conversations/${sessionId}/messages`,
        text,
        mode,
        (event) => {
          if (event.type === "status") setStatus(event.text ?? "");
          if (event.type === "delta")
            setMessages((value) =>
              value.map((m) =>
                m.id === id ? { ...m, body: m.body + (event.text ?? "") } : m,
              ),
            );
          if (event.type === "done")
            setMessages((value) =>
              value.map((m) =>
                m.id === id
                  ? {
                      ...m,
                      body: event.reply ?? m.body,
                      citations: event.citations,
                      pending: false,
                    }
                  : m,
              ),
            );
        },
        abort.signal,
      );
      try {
        setProgress(await request<Activity[]>(`${base}/progress`));
      } catch {
        setNotice(
          "Respuesta guardada. No se pudo actualizar el progreso; vuelve a abrir la sección.",
        );
      }
    } catch (e) {
      setError((e as Error).message);
      setMessages((value) =>
        value.map((m) =>
          m.id === id ? { ...m, pending: false, failed: true } : m,
        ),
      );
      setPrompt(text);
    } finally {
      setBusy(false);
      setStatus("");
      controller.current = null;
    }
  }
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const file = (form.elements.namedItem("file") as HTMLInputElement)
      .files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      setError("El PDF debe pesar como máximo 50 MB.");
      return;
    }
    setUploading(true);
    setError("");
    setNotice("");
    try {
      const result = await request<{
        material: Material;
        url: string;
        headers: Record<string, string>;
      }>(`${base}/materials/uploads`, "POST", {
        title: materialTitle || file.name,
        filename: file.name,
        kind: materialKind,
        unit: materialUnit,
        size: file.size,
      });
      const response = await fetch(result.url, {
        method: "PUT",
        headers: result.headers,
        body: file,
      });
      if (!response.ok)
        throw new Error(
          "No se pudo transferir el PDF. Solicita una nueva carga.",
        );
      setMaterials(await request<Material[]>(`${base}/materials`));
      setMaterialTitle("");
      form.reset();
      setNotice(
        "PDF recibido. Se mostrará como listo cuando termine la preparación.",
      );
    } catch (e) {
      setError((e as Error).message);
      setMaterials(
        await request<Material[]>(`${base}/materials`).catch(() => materials),
      );
    } finally {
      setUploading(false);
    }
  }
  async function saveOutline() {
    setBusy(true);
    setError("");
    try {
      const course = await request<Course>(`${base}/outline`, "PUT", {
        units,
        source_material_id: outlineSource,
      });
      setCourses((value) =>
        value.map((c) => (c.id === course.id ? course : c)),
      );
      setNotice(
        "Mapa confirmado. El tutor lo usará para orientar tus siguientes preguntas.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function editUnit(index: number, key: "title" | "objective", value: string) {
    setUnits((units) =>
      units.map((unit, i) => (i === index ? { ...unit, [key]: value } : unit)),
    );
  }
  if (authLoading) return <div className="loading">Abriendo tu cuaderno…</div>;
  if (!user)
    return (
      <main className="login-page">
        <div className="login-story">
          <span className="eyebrow">FINANTUTOR / CUADERNO DE ESTUDIO</span>
          <h1>
            Entender antes
            <br />
            de calcular.
          </h1>
          <p>
            Un espacio para conectar teoría, decisiones y modelos financieros.
          </p>
          <div className="formula">VAN = ∑ FCₜ / (1 + r)ᵗ</div>
        </div>
        <form className="login-form" onSubmit={signIn}>
          <span className="eyebrow">TU ESPACIO PERSONAL</span>
          <h2>{needsPassword ? "Elige tu contraseña" : "Volver al estudio"}</h2>
          {!needsPassword && (
            <label>
              Correo
              <input
                autoComplete="username"
                type="email"
                required
                value={credentials.username}
                onChange={(e) =>
                  setCredentials((v) => ({ ...v, username: e.target.value }))
                }
              />
            </label>
          )}
          <label>
            {needsPassword ? "Nueva contraseña" : "Contraseña"}
            <input
              type="password"
              autoComplete={needsPassword ? "new-password" : "current-password"}
              minLength={needsPassword ? 12 : 1}
              required
              value={credentials.password}
              onChange={(e) =>
                setCredentials((v) => ({ ...v, password: e.target.value }))
              }
            />
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="primary" disabled={busy}>
            {busy ? "Entrando…" : "Abrir cuaderno →"}
          </button>
        </form>
      </main>
    );
  return (
    <div className="workspace">
      <aside className="sidebar">
        <a className="brand" href="#" onClick={(e) => e.preventDefault()}>
          F<span>finantutor</span>
        </a>
        <p className="sidebar-caption">TU CUADERNO DE ESTUDIO</p>
        <label className="course-picker">
          Asignatura
          <select
            disabled={busy || uploading}
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
          >
            {!courses.length && <option value="">Crear una asignatura</option>}
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </label>
        <nav aria-label="Secciones del cuaderno">
          {[
            ["chat", "01", "Conversación"],
            ["materials", "02", "Materiales"],
            ["course", "03", "Mapa del curso"],
            ["progress", "04", "Mi progreso"],
          ].map(([id, n, label]) => (
            <button
              key={id}
              className={tab === id ? "active" : ""}
              onClick={() => {
                setTab(id);
                setError("");
                setNotice("");
              }}
            >
              <span>{n}</span>
              {label}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <p>
            Maestría en Inteligencia Artificial
            <br />
            <strong>Aprendizaje guiado por tus materiales.</strong>
          </p>
          {local ? (
            <span className="local-badge">Sesión local de desarrollo</span>
          ) : (
            <button
              className="text-button"
              onClick={() => {
                void logout().then(() => {
                  setUser(null);
                  setCourses([]);
                  setCourseId("");
                  setMessages([]);
                  setMaterials([]);
                  setProgress([]);
                });
              }}
            >
              Cerrar sesión
            </button>
          )}
        </div>
      </aside>
      <main className="main">
        <header className="page-header">
          <div>
            <span className="eyebrow">
              MODELOS FINANCIEROS / EVALUACIÓN DE PROYECTOS
            </span>
            <h1>
              {tab === "chat"
                ? "Pensar. Preguntar. Comprender."
                : tab === "materials"
                  ? "Tu biblioteca de referencia."
                  : tab === "course"
                    ? "Una ruta para aprender."
                    : "El aprendizaje deja huella."}
            </h1>
          </div>
          <span className="course-badge">Estudio personal</span>
        </header>
        {error && (
          <div className="error banner" role="alert">
            {error}
            <button aria-label="Cerrar error" onClick={() => setError("")}>
              ×
            </button>
          </div>
        )}
        {notice && (
          <p className="notice" role="status">
            {notice}
          </p>
        )}
        {!selected ? (
          <section className="empty onboarding">
            <span className="eyebrow">PRIMER PASO</span>
            <h2>Abre un cuaderno para tu curso.</h2>
            <p>
              Después añade el sílabo y tus materiales. El tutor trabajará con
              esas fuentes.
            </p>
            <form onSubmit={createCourse}>
              <label>
                Nombre de la asignatura
                <input
                  required
                  maxLength={200}
                  value={courseName}
                  onChange={(e) => setCourseName(e.target.value)}
                />
              </label>
              <button className="primary" disabled={busy}>
                Crear cuaderno →
              </button>
            </form>
          </section>
        ) : (
          <>
            {tab === "chat" && (
              <section className="chat-section">
                <div className="chat-toolbar">
                  <span>{selected.title}</span>
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={newConversation}
                  >
                    Nueva conversación ↗
                  </button>
                </div>
                <div
                  className="messages"
                  aria-label="Conversación con el tutor"
                >
                  {!messages.length && (
                    <div className="welcome">
                      <div className="tutor-seal">ƒ</div>
                      <h2>
                        Empecemos por lo que
                        <br />
                        quieres entender.
                      </h2>
                      <p>
                        Podemos desarrollar una idea, practicar un caso o
                        revisar tus pasos. Comparte los datos y el contexto que
                        tengas.
                      </p>
                      <div className="starters">
                        {[
                          "¿Cómo se interpreta el VAN?",
                          "Ayúdame a revisar mi procedimiento",
                          "Quiero practicar con un caso",
                        ].map((text) => (
                          <button key={text} onClick={() => setPrompt(text)}>
                            {text}
                            <span>↗</span>
                          </button>
                        ))}
                      </div>
                      {!materials.some((m) => m.status === "ready") && (
                        <p className="source-note">
                          Añade el sílabo o la teoría en Materiales para
                          trabajar con las fuentes del curso.
                        </p>
                      )}
                    </div>
                  )}
                  {messages.map((message) => (
                    <article
                      key={message.id}
                      className={`message ${message.role} ${message.failed ? "failed" : ""}`}
                    >
                      <span className="message-author">
                        {message.role === "user" ? "TÚ" : "TUTOR"}
                        {message.pending ? " · elaborando respuesta" : ""}
                      </span>
                      <div className="markdown">
                        <Markdown
                          remarkPlugins={[remarkMath]}
                          rehypePlugins={[rehypeKatex]}
                          components={{
                            a: ({ href, children }) => (
                              <a
                                href={
                                  href?.startsWith("https://")
                                    ? href
                                    : undefined
                                }
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {children}
                              </a>
                            ),
                          }}
                        >
                          {message.body || "Pensando en tu pregunta…"}
                        </Markdown>
                      </div>
                      {Boolean(message.citations?.length) && (
                        <div className="citations">
                          <span>MATERIALES CONSULTADOS</span>
                          {message.citations?.map((c) => (
                            <button
                              key={c.source_id}
                              onClick={() => {
                                void openSource(courseId, c).catch((e) =>
                                  setError(e.message),
                                );
                              }}
                            >
                              [{c.source_id}] {c.title}
                              {c.page ? ` · p. ${c.page}` : ""} ↗
                            </button>
                          ))}
                        </div>
                      )}
                      {message.failed && (
                        <p className="source-note">
                          Respuesta incompleta; puedes enviar de nuevo tu
                          pregunta.
                        </p>
                      )}
                    </article>
                  ))}
                  {busy && (
                    <p className="thinking" role="status">
                      {status || "Preparando una explicación…"}
                    </p>
                  )}
                  <div ref={bottom} />
                </div>
                <form className="composer" onSubmit={send}>
                  <label className="sr-only" htmlFor="prompt">
                    Tu pregunta al tutor
                  </label>
                  <textarea
                    id="prompt"
                    value={prompt}
                    maxLength={12000}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Escribe una pregunta o comparte tu procedimiento…"
                    rows={3}
                    disabled={busy}
                  />
                  <div className="composer-bottom">
                    <label>
                      Quiero
                      <select
                        value={mode}
                        onChange={(e) => setMode(e.target.value)}
                        disabled={busy}
                      >
                        {modes.map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      className="primary"
                      disabled={busy || !prompt.trim()}
                    >
                      {busy ? "Elaborando…" : "Preguntar →"}
                    </button>
                  </div>
                </form>
                <p className="fine-print">
                  Comprueba los supuestos y consulta las fuentes. El tutor
                  acompaña tu aprendizaje.
                </p>
              </section>
            )}
            {tab === "materials" && (
              <section className="section-grid">
                <div className="panel upload-panel">
                  <span className="eyebrow">BASE DE CONOCIMIENTO</span>
                  <h2>Trae la teoría a la conversación.</h2>
                  <p>
                    Sube PDFs con texto seleccionable. El sílabo también puede
                    servir para preparar el mapa de unidades.
                  </p>
                  <form onSubmit={upload}>
                    <label>
                      Título
                      <input
                        value={materialTitle}
                        maxLength={200}
                        onChange={(e) => setMaterialTitle(e.target.value)}
                        placeholder="Ej. Semana 2 · Flujo de caja"
                      />
                    </label>
                    <label>
                      Tipo de material
                      <select
                        value={materialKind}
                        onChange={(e) =>
                          setMaterialKind(
                            e.target.value as "theory" | "syllabus",
                          )
                        }
                      >
                        <option value="theory">Teoría o ejercicios</option>
                        <option value="syllabus">Sílabo</option>
                      </select>
                    </label>
                    <label>
                      Unidad o semana (opcional)
                      <input
                        value={materialUnit}
                        maxLength={200}
                        onChange={(e) => setMaterialUnit(e.target.value)}
                      />
                    </label>
                    <label className="file-picker">
                      Seleccionar PDF
                      <input
                        name="file"
                        type="file"
                        accept="application/pdf,.pdf"
                        required
                      />
                    </label>
                    <p className="fine-print">
                      Hasta 50 MB · No se ejecutan archivos ni macros.
                    </p>
                    <button className="primary" disabled={uploading}>
                      {uploading ? "Subiendo…" : "Añadir material →"}
                    </button>
                  </form>
                </div>
                <div className="panel library">
                  <span className="eyebrow">
                    BIBLIOTECA / {materials.length} DOCUMENTOS
                  </span>
                  <h2>Fuentes de este cuaderno.</h2>
                  {!materials.length ? (
                    <p className="empty-text">
                      Tu biblioteca empieza con el primer PDF.
                    </p>
                  ) : (
                    materials.map((material) => (
                      <article className="material" key={material.id}>
                        <div className="pdf-icon">PDF</div>
                        <div>
                          <h3>{material.title}</h3>
                          <p>
                            {material.kind === "syllabus"
                              ? "Sílabo"
                              : "Teoría o ejercicios"}
                            {material.page_count
                              ? ` · ${material.page_count} páginas`
                              : ""}
                          </p>
                          <span
                            className={`material-status ${material.status}`}
                          >
                            {statusLabels[material.status] ?? material.status}
                          </span>
                          {material.error && (
                            <p className="error-text">{material.error}</p>
                          )}
                          {material.status === "ready" && (
                            <button
                              className="text-button"
                              onClick={() => {
                                void openSource(courseId, {
                                  source_id: "S0",
                                  material_id: material.id,
                                  title: material.title,
                                  version: 1,
                                }).catch((e) => setError(e.message));
                              }}
                            >
                              Abrir documento ↗
                            </button>
                          )}
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </section>
            )}
            {tab === "course" && (
              <section className="panel outline-panel">
                <span className="eyebrow">SÍLABO / UNIDADES / OBJETIVOS</span>
                <h2>Confirma la ruta del curso.</h2>
                <p>
                  Revisa las unidades extraídas del sílabo o escríbelas según tu
                  material. El tutor usará únicamente el mapa que confirmes.
                </p>
                <label>
                  Preparar mapa desde un sílabo
                  <select
                    value={outlineSource ?? ""}
                    onChange={(e) => {
                      const source = materials.find(
                        (m) => m.id === e.target.value,
                      );
                      setOutlineSource(source?.id);
                      setUnits(source?.outline_draft ?? []);
                    }}
                  >
                    <option value="">Edición manual</option>
                    {materials
                      .filter(
                        (m) => m.kind === "syllabus" && m.status === "ready",
                      )
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.title}
                        </option>
                      ))}
                  </select>
                </label>
                {!units.length && (
                  <p className="empty-text">
                    Aún no hay unidades. Si la extracción no identificó títulos,
                    añádelos según tu sílabo.
                  </p>
                )}
                {units.map((unit, index) => (
                  <div className="unit" key={index}>
                    <span className="unit-number">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <label>
                        Unidad o tema
                        <input
                          value={unit.title}
                          maxLength={200}
                          onChange={(e) =>
                            editUnit(index, "title", e.target.value)
                          }
                        />
                      </label>
                      <label>
                        Objetivo de aprendizaje
                        <textarea
                          value={unit.objective}
                          maxLength={2000}
                          onChange={(e) =>
                            editUnit(index, "objective", e.target.value)
                          }
                          rows={2}
                        />
                      </label>
                      {unit.source_page && (
                        <p className="fine-print">
                          Título extraído de la página {unit.source_page}.
                          Verifica su contenido.
                        </p>
                      )}
                    </div>
                    <button
                      className="text-button"
                      aria-label={`Eliminar unidad ${index + 1}`}
                      onClick={() =>
                        setUnits((v) => v.filter((_, i) => i !== index))
                      }
                    >
                      ×
                    </button>
                  </div>
                ))}
                <div className="actions">
                  <button
                    className="secondary"
                    disabled={busy || units.length >= 60}
                    onClick={() =>
                      setUnits((v) => [...v, { title: "", objective: "" }])
                    }
                  >
                    + Añadir unidad
                  </button>
                  <button
                    className="primary"
                    disabled={busy || units.some((u) => !u.title.trim())}
                    onClick={() => {
                      void saveOutline();
                    }}
                  >
                    Confirmar mapa →
                  </button>
                </div>
              </section>
            )}
            {tab === "progress" && (
              <section className="panel progress-panel">
                <span className="eyebrow">ACTIVIDADES REGISTRADAS</span>
                <h2>Lo que has trabajado.</h2>
                <p>
                  Este registro recoge temas y práctica explícita. No representa
                  una nota ni una certificación de dominio.
                </p>
                {!progress.length ? (
                  <div className="empty-text">
                    Después de trabajar un tema con el tutor, puedes pedirle que
                    registre tu actividad.
                  </div>
                ) : (
                  progress
                    .slice()
                    .reverse()
                    .map((activity) => (
                      <article className="activity" key={activity.id}>
                        <span className={`outcome ${activity.outcome}`}>
                          {outcomeLabels[activity.outcome] ?? activity.outcome}
                        </span>
                        <h3>{activity.topic}</h3>
                        <p>{activity.evidence}</p>
                        <time dateTime={activity.created_at}>
                          {new Date(activity.created_at).toLocaleDateString(
                            "es-PE",
                            { day: "numeric", month: "long", year: "numeric" },
                          )}
                        </time>
                      </article>
                    ))
                )}
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
