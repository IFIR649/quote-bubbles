import React, { useEffect } from "react";

export default function Toast({ message, open, onClose, duration = 1800 }) {
  useEffect(() => {
    if (!open) return undefined;
    const t = setTimeout(() => onClose?.(), duration);
    return () => clearTimeout(t);
  }, [open, duration, onClose]);

  return (
    <div className={`toast ${open ? "open" : ""}`} role="status" aria-live="polite">
      {message}
    </div>
  );
}
