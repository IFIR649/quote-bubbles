const { app, BrowserWindow, ipcMain, screen } = require("electron");
const path = require("path");
const { db } = require("./db");
const { createScheduler } = require("./scheduler");

let mainWin = null;
let overlayWin = null;
let scheduler = null;

function createMainWindow() {
  mainWin = new BrowserWindow({
    width: 1100,
    height: 720,
    backgroundColor: "#0b0b0c",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL || "http://localhost:5173";
  mainWin.loadURL(devUrl);
}

function createOverlayWindow() {
  const display = screen.getPrimaryDisplay();
  const { width } = display.workAreaSize;

  const w = Math.min(520, width - 40);

  overlayWin = new BrowserWindow({
    width: w,
    height: 150,
    x: Math.floor((width - w) / 2),
    y: 12,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    focusable: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL || "http://localhost:5173";
  overlayWin.loadURL(devUrl + "#/overlay");
}

function showOverlay(payload) {
  if (!overlayWin) return;
  overlayWin.webContents.send("overlay:show", payload);
  overlayWin.showInactive(); // sin robar foco
}

app.whenReady().then(() => {
  createMainWindow();
  createOverlayWindow();

  // QUOTES
  ipcMain.handle("quotes:list", () => db.listQuotes());
  ipcMain.handle("quotes:add", (_, q) => db.addQuote(q));
  ipcMain.handle("quotes:delete", (_, id) => db.deleteQuote(id));
  ipcMain.handle("quotes:bulkImport", (_, rows) => db.bulkImport(rows));

  // TAGS
  ipcMain.handle("tags:list", () => db.listTags());
  ipcMain.handle("tags:add", (_, name) => db.addTag(name));
  ipcMain.handle("tags:delete", (_, id) => db.deleteTag(id));

  // SETTINGS
  ipcMain.handle("settings:get", (_, key, fallback) => db.getSetting(key, fallback));
  ipcMain.handle("settings:set", (_, key, value) => db.setSetting(key, value));

  // QUEUE
  ipcMain.handle("queue:list", () => db.queueList());
  ipcMain.handle("queue:add", (_, quoteId) => db.queueAdd(quoteId));
  ipcMain.handle("queue:remove", (_, queueId) => db.queueRemove(queueId));
  ipcMain.handle("queue:clear", () => db.queueClear());
  ipcMain.handle("queue:next", () => db.queueNext());

  // OVERLAY
  ipcMain.handle("overlay:push", (_, payload) => {
    showOverlay(payload);
    return true;
  });
  ipcMain.handle("overlay:hide", () => {
    if (overlayWin) overlayWin.hide();
    return true;
  });
  ipcMain.handle("overlay:pushNextFromQueue", () => {
    const quote = db.queueNext();
    if (quote) showOverlay({ quote });
    return !!quote;
  });

  // SCHEDULER
  const defaultMode = {
    enabled: true,
    mode: "surprise",
    focusMinutes: 5,
    surpriseMinMinutes: 20,
    surpriseMaxMinutes: 60,
    customMinutes: 10,
    tagIds: []
  };

  scheduler = createScheduler({
    onQuote: (quote) => showOverlay({ quote }),
    getConfig: () => db.getSetting("app:mode", defaultMode),
    pickQuoteCustom: () => db.queueNext()
  });

  scheduler.start();

  ipcMain.handle("scheduler:resync", () => {
    if (scheduler) scheduler.resync();
    return true;
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
      createOverlayWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
