import React, { useEffect, useMemo, useState } from "react";
import { api } from "./api";
import Overlay from "./overlay/Overlay.jsx";
import Toast from "./components/Toast.jsx";
import ImportJson from "./views/ImportJson.jsx";
import Modes from "./views/Modes.jsx";

export default function App() {
  const isOverlay = useMemo(() => window.location.hash === "#/overlay", []);
  if (isOverlay) return <Overlay />;

  const [tab, setTab] = useState("quotes"); // quotes | import | modes

  const [quotes, setQuotes] = useState([]);
  const [form, setForm] = useState({ text: "", book: "", author: "", tags: "" });
  const [toast, setToast] = useState({ open: false, message: "" });

  function showToast(message) {
    setToast({ open: true, message });
  }

  async function refresh() {
    const list = await api.quotes.list();
    setQuotes(list);
  }

  useEffect(() => { refresh(); }, []);

  async function addQuote(e) {
    e.preventDefault();
    if (!form.text.trim()) return;
    await api.quotes.add(form);
    setForm({ text: "", book: "", author: "", tags: "" });
    refresh();
  }

  async function del(id) {
    await api.quotes.delete(id);
    refresh();
  }

  async function addToQueue(id) {
    await api.queue.add(id);
    showToast("Agregada a la cola \u2705");
  }

  async function testBubble() {
    await api.overlay.push({
      quote: { text: "Prueba: burbuja activa \u2728", book: "Demo", author: "T\u00fa" }
    });
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div>
          <h1>Quote Bubbles</h1>
          <p>{"Frases que aparecen como burbujas arriba durante el d\u00eda."}</p>
        </div>
        <button className="btn" onClick={testBubble}>Probar burbuja</button>
      </header>

      <nav className="tabs">
        <button className={`tab ${tab==="quotes" ? "active":""}`} onClick={()=>setTab("quotes")}>Frases</button>
        <button className={`tab ${tab==="import" ? "active":""}`} onClick={()=>setTab("import")}>Importar</button>
        <button className={`tab ${tab==="modes" ? "active":""}`} onClick={()=>setTab("modes")}>Modos</button>
      </nav>

      {tab === "quotes" && (
        <div className="grid">
          <form className="card" onSubmit={addQuote}>
            <h2>Nueva frase</h2>
            <textarea
              placeholder="Pega aqu\u00ed una frase\u2026"
              value={form.text}
              onChange={(e) => setForm({ ...form, text: e.target.value })}
              rows={5}
            />
            <div className="row">
              <input
                placeholder="Libro"
                value={form.book}
                onChange={(e) => setForm({ ...form, book: e.target.value })}
              />
              <input
                placeholder="Autor"
                value={form.author}
                onChange={(e) => setForm({ ...form, author: e.target.value })}
              />
            </div>
            <input
              placeholder="Tags (ej. h\u00e1bitos, enfoque)"
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
            />
            <button className="btn primary" type="submit">Agregar</button>
          </form>

          <div className="card">
            <h2>Frases ({quotes.length})</h2>
            <div className="list">
              {quotes.map(q => (
                <div key={q.id} className="item">
                  <div className="itemText">
                    <div className="quote">{"\u201c"}{q.text}{"\u201d"}</div>
                    <div className="meta">{[q.book, q.author].filter(Boolean).join(" \u2014 ")}</div>
                  </div>
                  <div className="itemActions">
                    <button className="btn" onClick={() => addToQueue(q.id)}>+ Cola</button>
                    <button className="btn danger" onClick={() => del(q.id)}>Eliminar</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "import" && (
        <ImportJson onImported={refresh} />
      )}

      {tab === "modes" && (
        <Modes />
      )}

      <Toast
        open={toast.open}
        message={toast.message}
        onClose={() => setToast({ open: false, message: "" })}
      />
    </div>
  );
}
