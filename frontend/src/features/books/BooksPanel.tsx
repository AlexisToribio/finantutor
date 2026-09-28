import { useBookUpload } from "./useBookUpload";

export function BooksPanel() {
  const form = useBookUpload();

  return (
    <section className="panel books-panel" aria-labelledby="books-heading">
      <header className="panel-head">
        <div>
          <p className="section-index">MATERIAL DEL CURSO</p>
          <h2 id="books-heading">Sube material para estudiar</h2>
          <p className="lede">
            Comparte el sílabo, lecturas o casos en PDF. El tutor los consultará
            al responder tus preguntas.
          </p>
        </div>
      </header>

      <form className="book-form" onSubmit={form.submit}>
        <label className="drop">
          Archivo PDF <span className="file-limit">Hasta 50 MB</span>
          <input
            type="file"
            accept="application/pdf,.pdf"
            onChange={(event) => form.setFile(event.target.files?.[0] ?? null)}
            required
            disabled={form.pending}
          />
          <span className="file-name">{form.file ? form.file.name : "Selecciona o arrastra un PDF aquí"}</span>
        </label>
        <button
          type="submit"
          className="primary"
          disabled={form.pending || !form.file}
        >
          {form.pending ? "Subiendo material…" : "Subir material"}
        </button>
      </form>

      {form.pending ? (
        <p className="banner pending-note">
          Subiendo el archivo. La indexación continúa en segundo plano.
        </p>
      ) : null}
      {form.error ? (
        <p className="banner error" role="alert">
          {form.error}
        </p>
      ) : null}
      {form.uploaded ? (
        <p className="banner success" role="status">
          Material recibido. La preparación para consulta continúa en segundo plano.
        </p>
      ) : null}
    </section>
  );
}
