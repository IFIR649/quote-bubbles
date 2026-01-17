import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api";

const DEFAULT_MODE = {
  enabled: true,
  mode: "surprise",
  focusMinutes: 5,
  surpriseMinMinutes: 20,
  surpriseMaxMinutes: 60,
  customMinutes: 10,
  tagIds: []
};

export default function Modes() {
  const [cfg, setCfg] = useState(DEFAULT_MODE);
  const [tags, setTags] = useState([]);
  const [newTag, setNewTag] = useState("");
  const [savedMsg, setSavedMsg] = useState("");
  const [queue, setQueue] = useState([]);

  const selected = useMemo(() => new Set(cfg.tagIds || []), [cfg.tagIds]);

  async function refreshQueue() {
    const q = await api.queue.list();
    setQueue(q);
  }

  async function load() {
    const loaded = await api.settings.get("app:mode", DEFAULT_MODE);
    setCfg({ ...DEFAULT_MODE, ...loaded });
    const t = await api.tags.list();
    setTags(t);
    await refreshQueue();
  }

  useEffect(() => { load(); }, []);

  function toggleTag(id) {
    const idn = Number(id);
    const s = new Set(cfg.tagIds || []);
    if (s.has(idn)) s.delete(idn);
    else s.add(idn);
    setCfg({ ...cfg, tagIds: Array.from(s) });
  }

  async function save() {
    setSavedMsg("");
    await api.settings.set("app:mode", cfg);
    await api.scheduler.resync();
    setSavedMsg("Guardado. El scheduler se actualiz\u00f3.");
    setTimeout(() => setSavedMsg(""), 2500);
  }

  async function addTag() {
    const name = newTag.trim();
    if (!name) return;
    await api.tags.add(name);
    setNewTag("");
    setTags(await api.tags.list());
  }

  async function delTag(id) {
    await api.tags.delete(id);
    // si estaba seleccionado, lo quitamos
    const next = (cfg.tagIds || []).filter(x => x !== id);
    setCfg({ ...cfg, tagIds: next });
    setTags(await api.tags.list());
  }

  async function clearQueue() {
    await api.queue.clear();
    await refreshQueue();
  }

  async function removeQueueItem(queueId) {
    await api.queue.remove(queueId);
    await refreshQueue();
  }

  async function pushNextNow() {
    const ok = await api.overlay.pushNextFromQueue();
    if (!ok) setSavedMsg("La cola est\u00e1 vac\u00eda.");
    await refreshQueue();
  }

  return (
    <div className="card">
      <h2>Modos</h2>
      <p className="hint">{"Elige un modo y (opcional) filtra por tags. Si no eliges tags, usar\u00e1 cualquier frase."}</p>

      <div className="rowBetween">
        <label className="switch">
          <input
            type="checkbox"
            checked={cfg.enabled !== false}
            onChange={(e) => setCfg({ ...cfg, enabled: e.target.checked })}
          />
          <span>Activado</span>
        </label>

        <button className="btn primary" onClick={save}>Guardar</button>
      </div>

      <div className="modeBox">
        <div className="modeRow">
          <button className={`pill ${cfg.mode==="focus" ? "on":""}`} onClick={()=>setCfg({ ...cfg, mode:"focus" })}>Enfoque</button>
          <button className={`pill ${cfg.mode==="surprise" ? "on":""}`} onClick={()=>setCfg({ ...cfg, mode:"surprise" })}>Sorpresa</button>
          <button className={`pill ${cfg.mode==="custom" ? "on":""}`} onClick={()=>setCfg({ ...cfg, mode:"custom" })}>Personalizado</button>
        </div>

        {cfg.mode === "focus" && (
          <div className="modeSettings">
            <div className="field">
              <div className="label">{"Cada cu\u00e1ntos minutos"}</div>
              <input
                type="number"
                min="1"
                value={cfg.focusMinutes}
                onChange={(e)=>setCfg({ ...cfg, focusMinutes: Number(e.target.value) })}
              />
            </div>
            <div className="note">Este modo lanza frases constantemente con un intervalo fijo.</div>
          </div>
        )}

        {cfg.mode === "surprise" && (
          <div className="modeSettings">
            <div className="row">
              <div className="field">
                <div className="label">{"M\u00edn (min)"}</div>
                <input
                  type="number"
                  min="1"
                  value={cfg.surpriseMinMinutes}
                  onChange={(e)=>setCfg({ ...cfg, surpriseMinMinutes: Number(e.target.value) })}
                />
              </div>
              <div className="field">
                <div className="label">{"M\u00e1x (min)"}</div>
                <input
                  type="number"
                  min="1"
                  value={cfg.surpriseMaxMinutes}
                  onChange={(e)=>setCfg({ ...cfg, surpriseMaxMinutes: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="note">Este modo lanza frases en intervalos aleatorios dentro del rango.</div>
          </div>
        )}

        {cfg.mode === "custom" && (
          <div className="modeSettings">
            <div className="field">
              <div className="label">Intervalo (min)</div>
              <input
                type="number"
                min="1"
                value={cfg.customMinutes}
                onChange={(e)=>setCfg({ ...cfg, customMinutes: Number(e.target.value) })}
              />
            </div>
            <div className="note">
              Por ahora, "personalizado" usa el mismo picker (random con tags).
              Luego metemos la cola tipo Spotify con drag & drop.
            </div>
          </div>
        )}
      </div>

      {savedMsg && <div className="notice ok">{savedMsg}</div>}

      <div className="sep" />

      <h3>Tags (filtro por modo)</h3>

      <div className="tagAddRow">
        <input
          placeholder="Nuevo tag\u2026 (ej. enfoque)"
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") addTag(); }}
        />
        <button className="btn" onClick={addTag}>Agregar</button>
      </div>

      <div className="tagGrid">
        {tags.map(t => {
          const on = selected.has(t.id);
          return (
            <div key={t.id} className={`tagChip ${on ? "on":""}`}>
              <button className="tagMain" onClick={() => toggleTag(t.id)} title="Incluir/excluir">
                {t.name}
              </button>
              <button className="tagDel" onClick={() => delTag(t.id)} title="Eliminar tag">{"\u00d7"}</button>
            </div>
          );
        })}
        {tags.length === 0 && <div className="hint">{"A\u00fan no tienes tags. Crea uno para filtrar frases."}</div>}
      </div>

      <div className="sep" />

      <h3>Cola (modo Personalizado)</h3>
      <p className="hint">{"Cuando el modo est\u00e1 en Personalizado, primero se usa esta cola. Si se vac\u00eda, cae a random con tags."}</p>

      <div className="rowActions">
        <button className="btn" onClick={pushNextNow}>Siguiente ahora</button>
        <button className="btn danger" onClick={clearQueue}>Vaciar cola</button>
      </div>

      <div className="queueList">
        {queue.map(it => (
          <div key={it.queueId} className="queueItem">
            <div className="queueText">
              <div className="quote">{"\u201c"}{it.text}{"\u201d"}</div>
              <div className="meta">
                {[it.book, it.author].filter(Boolean).join(" \u2014 ")}
              </div>
            </div>
            <button className="btn danger" onClick={() => removeQueueItem(it.queueId)}>
              Quitar
            </button>
          </div>
        ))}
        {queue.length === 0 && <div className="hint">{"Cola vac\u00eda. En \"Frases\" usa \"+ Cola\"."}</div>}
      </div>
    </div>
  );
}
