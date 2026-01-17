const { db } = require("./db");

function minutes(n) {
  return n * 60 * 1000;
}
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * cfg shape:
 * {
 *   enabled: true,
 *   mode: "focus" | "surprise" | "custom",
 *   focusMinutes: 5,
 *   surpriseMinMinutes: 20,
 *   surpriseMaxMinutes: 60,
 *   customMinutes: 10,
 *   tagIds: [1,2,3]
 * }
 */
function createScheduler({ onQuote, getConfig, pickQuoteCustom }) {
  let timer = null;

  function computeDelay(cfg) {
    if (cfg.mode === "focus") {
      return minutes(Math.max(1, Number(cfg.focusMinutes || 5)));
    }
    if (cfg.mode === "surprise") {
      const mn = Math.max(1, Number(cfg.surpriseMinMinutes || 20));
      const mx = Math.max(mn, Number(cfg.surpriseMaxMinutes || 60));
      return minutes(randInt(mn, mx));
    }
    if (cfg.mode === "custom") {
      return minutes(Math.max(1, Number(cfg.customMinutes || 10)));
    }
    // default
    return minutes(30);
  }

  function pickQuote(cfg) {
    if (cfg.mode === "custom" && typeof pickQuoteCustom === "function") {
      const q = pickQuoteCustom(cfg);
      if (q) return q;
    }
    return db.pickRandomQuoteByTags(cfg.tagIds || []);
  }

  function scheduleNext() {
    clearTimeout(timer);
    const cfg = getConfig();

    if (!cfg || cfg.enabled === false) return;

    const delay = computeDelay(cfg);

    timer = setTimeout(() => {
      const quote = pickQuote(cfg);
      if (quote) onQuote(quote);
      scheduleNext();
    }, Math.max(1000, delay));
  }

  return {
    start() { scheduleNext(); },
    stop() { clearTimeout(timer); timer = null; },
    resync() { scheduleNext(); }
  };
}

module.exports = { createScheduler };
