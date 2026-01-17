const path = require("path");
const Database = require("better-sqlite3");
const { app } = require("electron");

const dbPath = path.join(app.getPath("userData"), "quotes.db");
const sqlite = new Database(dbPath);

sqlite.pragma("foreign_keys = ON");

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS quotes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text TEXT NOT NULL,
    book TEXT,
    author TEXT,
    enabled INTEGER NOT NULL DEFAULT 1,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    lastShownAt TEXT
  );

  CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS quote_tags (
    quoteId INTEGER NOT NULL,
    tagId INTEGER NOT NULL,
    PRIMARY KEY (quoteId, tagId),
    FOREIGN KEY (quoteId) REFERENCES quotes(id) ON DELETE CASCADE,
    FOREIGN KEY (tagId) REFERENCES tags(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  -- Para modo "custom" (cola tipo Spotify) lo dejaremos listo, pero sin UI avanzada aun
  CREATE TABLE IF NOT EXISTS queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quoteId INTEGER NOT NULL,
    position INTEGER NOT NULL,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (quoteId) REFERENCES quotes(id) ON DELETE CASCADE
  );
`);

function normalizeTagNames(input) {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input.map(x => String(x || "").trim()).filter(Boolean);
  }
  if (typeof input === "string") {
    // soporta "a,b,c"
    return input.split(",").map(s => s.trim()).filter(Boolean);
  }
  return [];
}

/** SETTINGS */
function getSetting(key, fallback) {
  const row = sqlite.prepare("SELECT value FROM settings WHERE key=?").get(key);
  return row ? JSON.parse(row.value) : fallback;
}
function setSetting(key, value) {
  sqlite.prepare(`
    INSERT INTO settings(key,value) VALUES(?,?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value
  `).run(key, JSON.stringify(value));
  return true;
}

/** TAGS CRUD */
function listTags() {
  return sqlite.prepare("SELECT * FROM tags ORDER BY name COLLATE NOCASE").all();
}
function addTag(name) {
  const clean = String(name || "").trim();
  if (!clean) return null;
  sqlite.prepare("INSERT OR IGNORE INTO tags(name) VALUES(?)").run(clean);
  return sqlite.prepare("SELECT * FROM tags WHERE name=?").get(clean);
}
function deleteTag(id) {
  sqlite.prepare("DELETE FROM tags WHERE id=?").run(id);
  return true;
}

/** QUOTES basic */
function listQuotes() {
  return sqlite.prepare("SELECT * FROM quotes ORDER BY id DESC").all();
}

function addQuote(q) {
  const text = String(q?.text || "").trim();
  if (!text) return null;

  const info = sqlite.prepare(`
    INSERT INTO quotes (text, book, author, enabled)
    VALUES (?, ?, ?, 1)
  `).run(
    text,
    String(q?.book || "").trim(),
    String(q?.author || "").trim()
  );

  const quoteId = info.lastInsertRowid;
  const tags = normalizeTagNames(q?.tags);
  setQuoteTags(quoteId, tags);

  return { id: quoteId };
}

function deleteQuote(id) {
  sqlite.prepare("DELETE FROM quotes WHERE id=?").run(id);
  return true;
}

/** QUOTE <-> TAGS */
function setQuoteTags(quoteId, tagNames) {
  const names = normalizeTagNames(tagNames);
  sqlite.prepare("DELETE FROM quote_tags WHERE quoteId=?").run(quoteId);

  const insJT = sqlite.prepare("INSERT OR IGNORE INTO quote_tags(quoteId, tagId) VALUES(?,?)");
  const getTagId = sqlite.prepare("SELECT id FROM tags WHERE name=?");

  for (const n of names) {
    addTag(n);
    const tag = getTagId.get(n);
    if (tag) insJT.run(quoteId, tag.id);
  }
}

/** Picking */
function pickRandomQuote() {
  const q = sqlite.prepare(`
    SELECT * FROM quotes
    WHERE enabled=1
    ORDER BY
      CASE WHEN lastShownAt IS NULL THEN 0 ELSE 1 END,
      RANDOM()
    LIMIT 1
  `).get();

  if (q) sqlite.prepare("UPDATE quotes SET lastShownAt=datetime('now') WHERE id=?").run(q.id);
  return q || null;
}

function pickRandomQuoteByTags(tagIds) {
  if (!tagIds || tagIds.length === 0) return pickRandomQuote();

  const ids = tagIds.map(Number).filter(n => Number.isFinite(n));
  if (ids.length === 0) return pickRandomQuote();

  const placeholders = ids.map(() => "?").join(",");
  const q = sqlite.prepare(`
    SELECT q.*
    FROM quotes q
    JOIN quote_tags qt ON qt.quoteId=q.id
    WHERE q.enabled=1 AND qt.tagId IN (${placeholders})
    GROUP BY q.id
    ORDER BY
      CASE WHEN q.lastShownAt IS NULL THEN 0 ELSE 1 END,
      RANDOM()
    LIMIT 1
  `).get(...ids);

  if (q) sqlite.prepare("UPDATE quotes SET lastShownAt=datetime('now') WHERE id=?").run(q.id);
  return q || null;
}

/** BULK IMPORT (JSON) */
function bulkImport(rows) {
  const insert = sqlite.prepare(`
    INSERT INTO quotes (text, book, author, enabled)
    VALUES (?, ?, ?, 1)
  `);

  const tx = sqlite.transaction((items) => {
    let ok = 0, bad = 0;

    for (const r of items) {
      const text = String(r?.text || "").trim();
      if (!text) { bad++; continue; }

      const info = insert.run(
        text,
        String(r?.book || "").trim(),
        String(r?.author || "").trim()
      );

      const quoteId = info.lastInsertRowid;
      const tags = normalizeTagNames(r?.tags);
      setQuoteTags(quoteId, tags);

      ok++;
    }

    return { ok, bad };
  });

  return tx(Array.isArray(rows) ? rows : []);
}

/** QUEUE */
function queueList(limit = 200) {
  return sqlite.prepare(`
    SELECT q.id as queueId, q.position, q.createdAt, qt.*
    FROM queue q
    JOIN quotes qt ON qt.id = q.quoteId
    ORDER BY q.position ASC, q.id ASC
    LIMIT ?
  `).all(limit);
}

function queueNext() {
  const first = sqlite.prepare(`
    SELECT id, quoteId
    FROM queue
    ORDER BY position ASC, id ASC
    LIMIT 1
  `).get();

  if (!first) return null;

  const quote = sqlite.prepare("SELECT * FROM quotes WHERE id=?").get(first.quoteId);
  sqlite.prepare("DELETE FROM queue WHERE id=?").run(first.id);

  if (quote) sqlite.prepare("UPDATE quotes SET lastShownAt=datetime('now') WHERE id=?").run(quote.id);

  return quote || null;
}

function queueAdd(quoteId) {
  const qid = Number(quoteId);
  if (!Number.isFinite(qid) || qid <= 0) return null;

  const maxPosRow = sqlite.prepare("SELECT MAX(position) as maxPos FROM queue").get();
  const nextPos = (maxPosRow?.maxPos ?? 0) + 1;

  const info = sqlite.prepare(`
    INSERT INTO queue (quoteId, position)
    VALUES (?, ?)
  `).run(qid, nextPos);

  return { queueId: info.lastInsertRowid, position: nextPos };
}

function queueRemove(queueId) {
  sqlite.prepare("DELETE FROM queue WHERE id=?").run(Number(queueId));
  return true;
}

function queueClear() {
  sqlite.prepare("DELETE FROM queue").run();
  return true;
}

const db = {
  // quotes
  listQuotes,
  addQuote,
  deleteQuote,
  pickRandomQuote,
  pickRandomQuoteByTags,

  // tags
  listTags,
  addTag,
  deleteTag,

  // settings
  getSetting,
  setSetting,

  // import
  bulkImport,

  // queue
  queueList,
  queueNext,
  queueAdd,
  queueRemove,
  queueClear,
};

module.exports = { db };
