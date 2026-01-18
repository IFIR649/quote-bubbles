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
function createScheduler({ onQuote, getConfig, pickQuoteCustom, getIdleTime }) {
  let timer = null;

  function computeDelay(cfg) {
    const smart = cfg.smart || {};
    const smartEnabled = smart.enabled !== false;
    const jitterEnabled = smart.jitterEnabled !== false;
    if (cfg.mode === "focus") {
      const base = Math.max(1, Number(cfg.focusMinutes || 5));
      if (smartEnabled && jitterEnabled) {
        const mn = Math.max(1, Number(smart.focusJitterMin ?? base));
        const mx = Math.max(mn, Number(smart.focusJitterMax ?? base));
        return minutes(randInt(mn, mx));
      }
      return minutes(base);
    }
    if (cfg.mode === "surprise") {
      let mn = Math.max(1, Number(cfg.surpriseMinMinutes || 20));
      let mx = Math.max(mn, Number(cfg.surpriseMaxMinutes || 60));
      if (smartEnabled && jitterEnabled) {
        mn = Math.max(1, Number(smart.surpriseJitterMin ?? mn));
        mx = Math.max(mn, Number(smart.surpriseJitterMax ?? mx));
      }
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

  function canShowNow(cfg) {
    const smart = cfg.smart || {};
    const smartEnabled = smart.enabled !== false;
    if (!smartEnabled) return true;
    if (typeof getIdleTime !== "function") return true;
    let idle = 0;
    try {
      idle = Number(getIdleTime()) || 0;
    } catch {
      return true;
    }
    const gate = Number(smart.idleGateSec ?? 60);
    if (idle >= gate) return false;
    return true;
  }

  function scheduleInMinutes(mins) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const cfg = getConfig();
      if (!cfg || cfg.enabled === false) return;
      attemptShow(cfg);
    }, minutes(mins));
  }

  function attemptShow(cfg) {
    if (!canShowNow(cfg)) {
      scheduleInMinutes(2);
      return;
    }
    const quote = pickQuote(cfg);
    if (quote) onQuote(quote);
    scheduleNext();
  }

  function scheduleNext() {
    clearTimeout(timer);
    const cfg = getConfig();
    if (!cfg || cfg.enabled === false) return;
    const delay = computeDelay(cfg);
    timer = setTimeout(() => {
      const nextCfg = getConfig();
      if (!nextCfg || nextCfg.enabled === false) return;
      attemptShow(nextCfg);
    }, Math.max(1000, delay));
  }

  return {
    start() { scheduleNext(); },
    stop() { clearTimeout(timer); timer = null; },
    resync() { scheduleNext(); }
  };
}

module.exports = { createScheduler };
