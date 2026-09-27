import type { FormEvent } from "react";
import { openSource, type Material } from "../../api";

const statusLabels: Record<string, string> = {
  uploading: "Esperando archivo",
  uploaded: "Cargado",
  indexing: "Preparando material",
  ready: "Listo para consultar",
  failed: "Requiere revisión",
};

type Props = {
  courseId: string;
  materials: Material[];
  title: string;
  setTitle: (value: string) => void;
  kind: "theory" | "syllabus";
  setKind: (value: "theory" | "syllabus") => void;
  uploading: boolean;
  onUpload: (event: FormEvent<HTMLFormElement>) => void;
  onError: (message: string) => void;
};

export function MaterialsPanel({ courseId, materials, title, setTitle, kind, setKind, uploading, onUpload, onError }: Props) {
  return (
    <section className="section-grid">
      <div className="panel upload-panel">
        <span className="eyebrow">BASE DE CONOCIMIENTO</span>
        <h2>Trae la teoría a la conversación.</h2>
        <p>Sube el sílabo y el material de estudio en PDF para que el tutor los use como referencia.</p>
        <form onSubmit={onUpload}>
          <label>Título<input value={title} maxLength={200} onChange={(event) => setTitle(event.target.value)} placeholder="Ej. Semana 2 · Flujo de caja" /></label>
          <label>Tipo de material
            <select value={kind} onChange={(event) => setKind(event.target.value as "theory" | "syllabus")}>
              <option value="theory">Teoría o ejercicios</option>
              <option value="syllabus">Sílabo</option>
            </select>
          </label>
          <label className="file-picker">Seleccionar PDF<input name="file" type="file" accept="application/pdf,.pdf" required /></label>
          <p className="fine-print">Hasta 50 MB · No se ejecutan archivos ni macros.</p>
          <button className="primary" disabled={uploading}>{uploading ? "Subiendo…" : "Añadir material →"}</button>
        </form>
      </div>
      <div className="panel library">
        <span className="eyebrow">BIBLIOTECA / {materials.length} DOCUMENTOS</span>
        <h2>Fuentes de este cuaderno.</h2>
        {!materials.length ? <p className="empty-text">Tu biblioteca empieza con el primer PDF.</p> : materials.map((material) => (
          <article className="material" key={material.id}>
            <div className="pdf-icon">PDF</div>
            <div>
              <h3>{material.title}</h3>
              <p>{material.kind === "syllabus" ? "Sílabo" : "Teoría o ejercicios"}{material.page_count ? ` · ${material.page_count} páginas` : ""}</p>
              <span className={`material-status ${material.status}`}>{statusLabels[material.status] ?? material.status}</span>
              {material.error && <p className="error-text">{material.error}</p>}
              {material.status === "ready" && <button className="text-button" onClick={() => void openSource(courseId, { source_id: "S0", material_id: material.id, title: material.title, version: 1 }).catch((error) => onError(error.message))}>Abrir documento ↗</button>}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
