import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import {
  IconFocus,
  IconZap,
  IconCog,
  IconDrop,
  IconPop,
  IconMute,
  IconTag,
  IconList,
  IconChevronDown,
  IconChevronUp
} from "../ui/icons";

const DEFAULT_SMART = {
  enabled: true,
  idleGateSec: 60,
  jitterEnabled: true,
  focusJitterMin: 8,
  focusJitterMax: 15,
  surpriseJitterMin: 20,
  surpriseJitterMax: 60
};

const DEFAULT_MODE = {
  enabled: true,
  mode: "surprise",
  focusMinutes: 5,
  surpriseMinMinutes: 20,
  surpriseMaxMinutes: 60,
  customMinutes: 10,
  tagIds: [],
  smart: DEFAULT_SMART
};

export default function Modes() {
  const [cfg, setCfg] = useState(DEFAULT_MODE);
  const [tags, setTags] = useState([]);
  const [newTag, setNewTag] = useState("");
  const [savedMsg, setSavedMsg] = useState("");
  const [queue, setQueue] = useState([]);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [sound, setSound] = useState("drop");

  const selected = useMemo(() => new Set(cfg.tagIds || []), [cfg.tagIds]);
  const smart = cfg.smart || DEFAULT_SMART;
  const mode = cfg.mode;
  const enabled = cfg.enabled !== false;
  const smartEnabled = smart.enabled !== false;
  const jitterEnabled = smart.jitterEnabled !== false;

  const focusEveryMin = Number(cfg.focusMinutes ?? DEFAULT_MODE.focusMinutes);
  const surpriseMin = Number(cfg.surpriseMinMinutes ?? DEFAULT_MODE.surpriseMinMinutes);
  const surpriseMax = Number(cfg.surpriseMaxMinutes ?? DEFAULT_MODE.surpriseMaxMinutes);
  const customEveryMin = Number(cfg.customMinutes ?? DEFAULT_MODE.customMinutes);
  const idleGateSec = Number(smart.idleGateSec ?? DEFAULT_SMART.idleGateSec);
  const focusMin = Number(smart.focusJitterMin ?? DEFAULT_SMART.focusJitterMin);
  const focusMax = Number(smart.focusJitterMax ?? DEFAULT_SMART.focusJitterMax);
  const surpriseJitterMin = Number(smart.surpriseJitterMin ?? DEFAULT_SMART.surpriseJitterMin);
  const surpriseJitterMax = Number(smart.surpriseJitterMax ?? DEFAULT_SMART.surpriseJitterMax);

  async function refreshQueue() {
    const q = await api.queue.list();
    setQueue(q);
  }

  async function load() {
    const loaded = await api.settings.get("app:mode", DEFAULT_MODE);
    setCfg({
      ...DEFAULT_MODE,
      ...loaded,
      smart: { ...DEFAULT_SMART, ...(loaded.smart || {}) }
    });
    const s = await api.settings.get("ui:sound", "drop");
    setSound(s === "pop" || s === "mute" || s === "drop" ? s : "drop");
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

  function updateSmart(patch) {
    setCfg((prev) => ({
      ...prev,
      smart: { ...DEFAULT_SMART, ...(prev.smart || {}), ...patch }
    }));
  }

  function setMode(next) {
    setCfg((prev) => ({ ...prev, mode: next }));
    if (next !== "custom") setQueueOpen(false);
  }

  async function setSoundMode(next) {
    setSound(next);
    await api.settings.set("ui:sound", next);

    if (next !== "mute") {
      const src = next === "drop" ? "/sfx/calm-drop.mp3" : "/sfx/neutral-pop.mp3";
      try {
        const a = new Audio(src);
        a.volume = 0.25;
        a.play().catch(() => {});
      } catch {}
    }
  }

  async function save() {
    setSavedMsg("");
    const nextCfg = {
      ...cfg,
      smart: { ...DEFAULT_SMART, ...(cfg.smart || {}) }
    };
    await api.settings.set("app:mode", nextCfg);
    await api.settings.set("ui:sound", sound);
    await api.scheduler.resync();
    setSavedMsg("Guardado. El scheduler se actualizo.");
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
    if (!ok) setSavedMsg("La cola esta vacia.");
    await refreshQueue();
  }

  function renderTagsSection() {
    return (
      <>
        <p className="hint">Si no eliges tags, usa cualquier frase.</p>
        <div className="tagAddRow">
          <input
            placeholder="Nuevo tag... (ej. enfoque)"
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
              <div key={t.id} className={`tagChip ${on ? "on" : ""}`}>
                <button className="tagMain" onClick={() => toggleTag(t.id)} title="Incluir/excluir">
                  {t.name}
                </button>
                <button className="tagDel" onClick={() => delTag(t.id)} title="Eliminar tag">{"\u00d7"}</button>
              </div>
            );
          })}
          {tags.length === 0 && <div className="hint">Aun no tienes tags. Crea uno para filtrar frases.</div>}
        </div>
      </>
    );
  }

  function renderQueueSection() {
    return (
      <>
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
          {queue.length === 0 && <div className="hint">Cola vacia. En "Frases" usa "+ Cola".</div>}
        </div>
      </>
    );
  }

  return (
    <div className="modesLayout">
      <div className="modesTop">
        <div>
          <h2>Modos</h2>
          <p className="muted">Elige un modo. Lo demas aparece solo cuando lo necesitas.</p>
        </div>

        <div className="modesTopActions">
          <label className="switchLine">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setCfg({ ...cfg, enabled: e.target.checked })}
            />
            <span>Activado</span>
          </label>

          <button className="btn primary" onClick={save}>
            Guardar
          </button>
        </div>
      </div>

      <div className="modeCards">
        <button
          type="button"
          className={`modeCard ${mode === "focus" ? "active" : ""}`}
          onClick={() => setMode("focus")}
        >
          <div className="modeIcon"><IconFocus /></div>
          <div className="modeLabel">Enfoque</div>
          <div className="modeHint">Constante y disciplinado</div>
        </button>

        <button
          type="button"
          className={`modeCard ${mode === "surprise" ? "active" : ""}`}
          onClick={() => setMode("surprise")}
        >
          <div className="modeIcon"><IconZap /></div>
          <div className="modeLabel">Sorpresa</div>
          <div className="modeHint">Aleatorio durante el dia</div>
        </button>

        <button
          type="button"
          className={`modeCard ${mode === "custom" ? "active" : ""}`}
          onClick={() => setMode("custom")}
        >
          <div className="modeIcon"><IconCog /></div>
          <div className="modeLabel">Personalizado</div>
          <div className="modeHint">Cola + reglas propias</div>
        </button>
      </div>

      <section className="configStage">
        {mode === "focus" && (
          <div className="configPanel">
            <div className="panelHeader">
              <h3>Modo Enfoque</h3>
              <p className="muted">Ideal para rutina. Intervalo fijo o con jitter natural.</p>
            </div>

            <div className="formGrid">
              <div className="field">
                <div className="label">Cada (min)</div>
                <input
                  type="number"
                  min="1"
                  value={focusEveryMin}
                  onChange={(e) => setCfg({ ...cfg, focusMinutes: Number(e.target.value || 1) })}
                />
              </div>

              <div className="fieldSwitch">
                <label className="switchLine">
                  <input
                    type="checkbox"
                    checked={smartEnabled}
                    onChange={(e) => updateSmart({ enabled: e.target.checked })}
                  />
                  <span>Ritmo inteligente</span>
                </label>
                <div className="muted tiny">Si estas inactivo, no muestra burbujas.</div>
              </div>

              {smartEnabled && (
                <>
                  <div className="field">
                    <div className="label">No molestar si inactivo (seg)</div>
                    <input
                      type="number"
                      min="10"
                      value={idleGateSec}
                      onChange={(e) => updateSmart({ idleGateSec: Number(e.target.value || 60) })}
                    />
                  </div>

                  <div className="fieldSwitch">
                    <label className="switchLine">
                      <input
                        type="checkbox"
                        checked={jitterEnabled}
                        onChange={(e) => updateSmart({ jitterEnabled: e.target.checked })}
                      />
                      <span>Rango natural (jitter)</span>
                    </label>
                    <div className="muted tiny">Evita patrones exactos para que no lo ignores.</div>
                  </div>

                  {jitterEnabled && (
                    <>
                      <div className="field">
                        <div className="label">Enfoque min (min)</div>
                        <input
                          type="number"
                          min="1"
                          value={focusMin}
                          onChange={(e) => updateSmart({ focusJitterMin: Number(e.target.value || 8) })}
                        />
                      </div>
                      <div className="field">
                        <div className="label">Enfoque max (min)</div>
                        <input
                          type="number"
                          min="1"
                          value={focusMax}
                          onChange={(e) => updateSmart({ focusJitterMax: Number(e.target.value || 15) })}
                        />
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {mode === "surprise" && (
          <div className="configPanel">
            <div className="panelHeader">
              <h3>Modo Sorpresa</h3>
              <p className="muted">Apariciones aleatorias para mantener atencion ligera.</p>
            </div>

            <div className="formGrid">
              <div className="field">
                <div className="label">Sorpresa min (min)</div>
                <input
                  type="number"
                  min="1"
                  value={surpriseMin}
                  onChange={(e) => setCfg({ ...cfg, surpriseMinMinutes: Number(e.target.value || 20) })}
                />
              </div>

              <div className="field">
                <div className="label">Sorpresa max (min)</div>
                <input
                  type="number"
                  min="1"
                  value={surpriseMax}
                  onChange={(e) => setCfg({ ...cfg, surpriseMaxMinutes: Number(e.target.value || 60) })}
                />
              </div>

              <div className="fieldSwitch">
                <label className="switchLine">
                  <input
                    type="checkbox"
                    checked={smartEnabled}
                    onChange={(e) => updateSmart({ enabled: e.target.checked })}
                  />
                  <span>Ritmo inteligente</span>
                </label>
                <div className="muted tiny">Evita enviar frases si estas AFK.</div>
              </div>

              {smartEnabled && (
                <>
                  <div className="field">
                    <div className="label">No molestar si inactivo (seg)</div>
                    <input
                      type="number"
                      min="10"
                      value={idleGateSec}
                      onChange={(e) => updateSmart({ idleGateSec: Number(e.target.value || 60) })}
                    />
                  </div>

                  <div className="fieldSwitch">
                    <label className="switchLine">
                      <input
                        type="checkbox"
                        checked={jitterEnabled}
                        onChange={(e) => updateSmart({ jitterEnabled: e.target.checked })}
                      />
                      <span>Rango natural (jitter)</span>
                    </label>
                    <div className="muted tiny">Evita patrones exactos para que no lo ignores.</div>
                  </div>

                  {jitterEnabled && (
                    <>
                      <div className="field">
                        <div className="label">Sorpresa min (min)</div>
                        <input
                          type="number"
                          min="1"
                          value={surpriseJitterMin}
                          onChange={(e) => updateSmart({ surpriseJitterMin: Number(e.target.value || 20) })}
                        />
                      </div>
                      <div className="field">
                        <div className="label">Sorpresa max (min)</div>
                        <input
                          type="number"
                          min="1"
                          value={surpriseJitterMax}
                          onChange={(e) => updateSmart({ surpriseJitterMax: Number(e.target.value || 60) })}
                        />
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {mode === "custom" && (
          <div className="configPanel">
            <div className="panelHeader">
              <h3>Modo Personalizado</h3>
              <p className="muted">Primero usa la cola. Si se vacia, cae a random por tags.</p>
            </div>

            <div className="formGrid">
              <div className="field">
                <div className="label">Cada (min)</div>
                <input
                  type="number"
                  min="1"
                  value={customEveryMin}
                  onChange={(e) => setCfg({ ...cfg, customMinutes: Number(e.target.value || 1) })}
                />
              </div>
            </div>
          </div>
        )}
      </section>

      {savedMsg && <div className="notice ok">{savedMsg}</div>}

      <section className="globalSettings">
        <div className="soundRow">
          <div className="soundLabel">Sonido</div>
          <div className="soundSeg">
            <button
              type="button"
              className={`soundBtn ${sound === "drop" ? "active" : ""}`}
              onClick={() => setSoundMode("drop")}
            >
              <IconDrop style={{ marginRight: 6 }} /> Calma
            </button>
            <button
              type="button"
              className={`soundBtn ${sound === "pop" ? "active" : ""}`}
              onClick={() => setSoundMode("pop")}
            >
              <IconPop style={{ marginRight: 6 }} /> Pop
            </button>
            <button
              type="button"
              className={`soundBtn ${sound === "mute" ? "active" : ""}`}
              onClick={() => setSoundMode("mute")}
            >
              <IconMute style={{ marginRight: 6 }} /> Silencio
            </button>
          </div>
        </div>

        <div className="accordion">
          <button
            type="button"
            className="accordionHeader"
            onClick={() => setTagsOpen(v => !v)}
          >
            <span className="accTitle"><IconTag style={{ marginRight: 8 }} /> Filtrar por Tags (opcional)</span>
            <span className="arrowIcon">{tagsOpen ? <IconChevronUp /> : <IconChevronDown />}</span>
          </button>

          {tagsOpen && (
            <div className="accordionBody">
              {renderTagsSection()}
            </div>
          )}
        </div>

        <div className={`accordion ${mode !== "custom" ? "disabled" : ""}`}>
          <button
            type="button"
            className="accordionHeader"
            disabled={mode !== "custom"}
            onClick={() => setQueueOpen(v => !v)}
          >
            <span className="accTitle"><IconList style={{ marginRight: 8 }} /> Cola (modo Personalizado)</span>
            <span className="arrowIcon">{queueOpen ? <IconChevronUp /> : <IconChevronDown />}</span>
          </button>

          {mode === "custom" && queueOpen && (
            <div className="accordionBody">
              {renderQueueSection()}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
