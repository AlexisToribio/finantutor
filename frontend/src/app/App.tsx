import { useEffect, useRef, useState, type FormEvent } from "react";
import { currentUser, local, login, logout, changePassword } from "../auth";
import { ChatPanel } from "../features/chat/ChatPanel";
import { MaterialsPanel } from "../features/materials/MaterialsPanel";
import { TabNav } from "./layout/TabNav";
import {
  request,
  chat,
  type Course,
  type Message,
  type Material,
} from "../api";
const DEFAULT_COURSE = "Modelos financieros y evaluación de proyectos";
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
    [tab, setTab] = useState<"chat" | "materials">("chat");
  const [courseName, setCourseName] = useState(DEFAULT_COURSE),
    [materials, setMaterials] = useState<Material[]>([]);
  const [messages, setMessages] = useState<Message[]>([]),
    [sessionId, setSessionId] = useState("");
  const [prompt, setPrompt] = useState(""),
    [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [materialTitle, setMaterialTitle] = useState(""),
    [materialKind, setMaterialKind] = useState<"theory" | "syllabus">("theory");
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
      request<Message[]>(`${base}/conversations/${session}/messages`),
    ])
      .then(([m, h]) => {
        if (!cancelled) {
          setMaterials(m);
          setMessages(h);
        }
      })
      .catch((e) => setError(e.message));
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
    setNotice("Conversación nueva. Tus materiales siguen disponibles.");
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
        "explain",
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
        <TabNav
          active={tab}
          onChange={(value) => {
            setTab(value);
            setError("");
            setNotice("");
          }}
        />
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
                ? "Conversa con tu tutor."
                : "Tu sílabo y materiales."}
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
            {tab === "chat" && <ChatPanel courseId={courseId} title={selected.title} messages={messages} materials={materials} prompt={prompt} setPrompt={setPrompt} busy={busy} status={status} onSend={send} onNewConversation={newConversation} onError={setError} bottom={bottom} />}
            {tab === "materials" && <MaterialsPanel courseId={courseId} materials={materials} title={materialTitle} setTitle={setMaterialTitle} kind={materialKind} setKind={setMaterialKind} uploading={uploading} onUpload={upload} onError={setError} />}
          </>
        )}
      </main>
    </div>
  );
}
