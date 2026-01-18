import React, { useEffect, useRef, useState } from "react";
import { api } from "../api";
import "./overlay.css";

export default function Overlay() {
  const [show, setShow] = useState(false);
  const [quote, setQuote] = useState(null);
  const [visibleMs, setVisibleMs] = useState(8000);
  const timersRef = useRef([]);

  async function getSoundPref() {
    try {
      const v = await api.settings.get("ui:sound", "drop");
      return v === "drop" || v === "pop" || v === "mute" ? v : "drop";
    } catch {
      return "drop";
    }
  }

  async function playSfx() {
    const pref = await getSoundPref();
    if (pref === "mute") return;
    const src = pref === "drop" ? "/sfx/calm-drop.mp3" : "/sfx/neutral-pop.mp3";
    try {
      const a = new Audio(src);
      a.volume = 0.25;
      a.play().catch(() => {});
    } catch {}
  }

  function clearTimers() {
    timersRef.current.forEach((id) => clearTimeout(id));
    timersRef.current = [];
  }

  useEffect(() => {
    const off = api.overlay.onShow((payload) => {
      clearTimers();
      const ms = payload.visibleMs ?? 8000;
      setQuote(payload.quote);
      setVisibleMs(ms);
      setShow(false);

      playSfx();

      timersRef.current.push(setTimeout(() => setShow(true), 90));
      timersRef.current.push(setTimeout(() => setShow(false), ms));
      timersRef.current.push(setTimeout(() => api.overlay.hide(), ms + 650));
    });

    return () => {
      clearTimers();
      off();
    };
  }, []);

  const quoteText = quote?.text || "";
  const meta = [quote?.book, quote?.author].filter(Boolean).join(" \u2014 ");

  return (
    <div
      className={`bubble-container ${show ? "show" : "hidden"}`}
      style={{ "--life-ms": `${visibleMs}ms` }}
    >
      <div className="bubble-glass">
        <div className="bubbleText">{"\u201c"}{quoteText}{"\u201d"}</div>
        {meta && <div className="bubbleMeta">{meta}</div>}
        <div className={`lifeBar ${show ? "run" : ""}`} />
      </div>
    </div>
  );
}
