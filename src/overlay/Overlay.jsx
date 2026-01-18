import React, { useEffect, useState } from "react";
import { api } from "../api";
import "./overlay.css";

export default function Overlay() {
  const [open, setOpen] = useState(false);
  const [quote, setQuote] = useState(null);

  useEffect(() => {
    const off = api.overlay.onShow((payload) => {
      setQuote(payload.quote);
      setOpen(true);

      setTimeout(() => {
        setOpen(false);
        setTimeout(() => api.overlay.hide(), 600); // espera animacion
      }, 8000);
    });

    return off;
  }, []);

  const quoteText = quote?.text || "";
  const meta = [quote?.book, quote?.author].filter(Boolean).join(" \u2014 ");

  return (
    <div className={`bubble-container ${open ? "show" : "hidden"}`}>
      <div className="bubble-glass">
        <div className="bubbleText">{"\u201c"}{quoteText}{"\u201d"}</div>
        {meta && <div className="bubbleMeta">{meta}</div>}
      </div>
    </div>
  );
}
