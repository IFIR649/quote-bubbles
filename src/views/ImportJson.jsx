import React, { useMemo, useState } from "react";
import { api } from "../api";

function normalizeQuotesFromJson(obj) {
  // Soporta:
  // { version: 1, quotes: [...] }
  // o directamente [...]
  const list = Array.isArray(obj) ? obj : (Array.isArray(obj?.quotes) ? obj.quotes : []);

  const rows = [];
  let bad = 0;

  for (const it of list) {
    const text = String(it?.text ?? it?.quote ?? "").trim();
    if (!text) { bad++; continue; }

    const book = String(it?.book ?? "").trim();
    const author = String(it?.author ?? "").trim();

    let tags = it?.tags ?? [];
    // tags puede venir como string "a,b" o array
    if (typeof tags === "string") tags = tags.split(",").map(s => s.trim()).filter(Boolean);
    if (!Array.isArray(tags)) tags = [];

    rows.push({ text, book, author, tags });
  }

  return { rows, bad };
}

export default function ImportJson({ onImported }) {
  const [raw, setRaw] = useState(`{
  "version": 1,
  "quotes": [
    {
      "text": "El h\u00e1bito es m\u00e1s fuerte que la motivaci\u00f3n.",
      "book": "Atomic Habits",
      "author": "James Clear",
      "tags": ["h\u00e1bitos", "motivaci\u00f3n"]
    }
  ]
}`.trim());

  const [preview, setPreview] = useState(null); // {rows, bad}
  const [result, setResult] = useState(null);
  const [openHelp, setOpenHelp] = useState(true);

  const aiPrompt = useMemo(() => (
`Quiero que conviertas frases en un JSON para importar en una app de Windows.
Reglas:
- Devuelve SOLO JSON v\u00e1lido, sin explicaciones.
- Usa este formato EXACTO:
{
  "version": 1,
  "quotes": [
    { "text": "", "book": "", "author": "", "tags": [] }
  ]
}
- "text" es obligatorio.
- "book" y "author" pueden ir vac\u00edos.
- "tags" debe ser un array de strings (ej. ["h\u00e1bitos","vida"]).
- No uses comillas raras. Usa comillas dobles ".
- Si no sabes el libro o autor, deja "".
Ahora convierte estas frases:
(PEGA AQU\u00cd TUS FRASES)`
  ), []);

  function doPreview() {
    setResult(null);
    try {
      const obj = JSON.parse(raw);
      const p = normalizeQuotesFromJson(obj);
      setPreview(p);
    } catch (e) {
      setPreview(null);
      setResult({ ok: false, message: "JSON inv\u00e1lido: revisa comas, llaves y comillas dobles." });
    }
  }

  async function doImport() {
    setResult(null);
    try {
      const obj = JSON.parse(raw);
      const p = normalizeQuotesFromJson(obj);
      setPreview(p);

      if (!p.rows.length) {
        setResult({ ok: false, message: "No encontr\u00e9 frases v\u00e1lidas (cada item debe tener 'text')." });
        return;
      }

      const res = await api.quotes.bulkImport(p.rows);
      setResult({ ok: true, message: `Importadas: ${res.ok}. Inv\u00e1lidas: ${res.bad}.` });
      onImported?.();
    } catch (e) {
      setResult({ ok: false, message: "No se pudo importar: JSON inv\u00e1lido." });
    }
  }

  return (
    <div className="card">
      <h2>Importar (JSON)</h2>
      <p className="hint">{"Pega tu JSON aqu\u00ed. Puedes importar "}
        <b>{`{ "version": 1, "quotes": [...] }`}</b>{" o directamente un array "}<b>[...]</b>.
      </p>

      <textarea
        className="mono"
        rows={14}
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        placeholder="Pega tu JSON\u2026"
      />

      <div className="rowActions">
        <button className="btn" onClick={doPreview}>Previsualizar</button>
        <button className="btn primary" onClick={doImport}>Importar</button>
      </div>

      {preview && (
        <div className="previewBox">
          <div><b>Detectadas:</b> {preview.rows.length} frases</div>
          <div><b>Inv\u00e1lidas:</b> {preview.bad} (sin "text")</div>
          {preview.rows.length > 0 && (
            <>
              <div className="sep" />
              <div className="miniTitle">Ejemplo 1:</div>
              <div className="miniQuote">{"\u201c"}{preview.rows[0].text}{"\u201d"}</div>
              <div className="miniMeta">
                {[preview.rows[0].book, preview.rows[0].author].filter(Boolean).join(" \u2014 ")}
              </div>
              <div className="miniTags">
                {(preview.rows[0].tags || []).slice(0, 6).map(t => (
                  <span className="chip" key={t}>{t}</span>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {result && (
        <div className={`notice ${result.ok ? "ok" : "bad"}`}>
          {result.message}
        </div>
      )}

      <div className="help">
        <button className="helpToggle" onClick={() => setOpenHelp(v => !v)}>
          {openHelp ? "\u25be" : "\u25b8"}{" \u00bfNo sabes c\u00f3mo hacer un JSON?"}
        </button>

        {openHelp && (
          <div className="helpBody">
            <p>{"Dile a tu IA de confianza que lo arme por ti. Copia y pega este texto y luego p\u00e9gale tus frases (o p\u00e1rrafos del autor/libro)."}</p>
            <div className="helpPromptTitle">Prompt listo para copiar:</div>
            <textarea className="mono" rows={10} readOnly value={aiPrompt} />
          </div>
        )}
      </div>
    </div>
  );
}
