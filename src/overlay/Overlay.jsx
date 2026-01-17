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
        setTimeout(() => api.overlay.hide(), 260); // espera animacion
      }, 8000);
    });

    return off;
  }, []);

  return (
    <div className={`overlayRoot ${open ? "open" : ""}`}>
      <div className="bubble">
        <div className="bubbleText">{"\u201c"}{quote?.text || ""}{"\u201d"}</div>
        <div className="bubbleMeta">
          {[quote?.book, quote?.author].filter(Boolean).join(" \u2014 ")}
        </div>
      </div>
    </div>
  );
}
