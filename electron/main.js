const { app, BrowserWindow, ipcMain, screen, Tray, Menu, dialog } = require("electron");
const path = require("path");
const { db } = require("./db");
const { createScheduler } = require("./scheduler");

let mainWin = null;
let overlayWin = null;
let scheduler = null;
let tray = null;
let isQuitting = false;

function createMainWindow() {
  mainWin = new BrowserWindow({
    width: 1100,
    height: 720,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL || "http://localhost:5173";
  mainWin.loadURL(devUrl);

  mainWin.on("close", (e) => {
    if (isQuitting) return;
    e.preventDefault();
    mainWin.hide();
    maybeShowTrayHint();
  });

  mainWin.on("minimize", (e) => {
    e.preventDefault();
    mainWin.hide();
  });
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

function showMain() {
  if (!mainWin) return;
  mainWin.show();
  mainWin.focus();
}

function hideMain() {
  if (!mainWin) return;
  mainWin.hide();
}

function maybeShowTrayHint() {
  // se guarda en settings para que solo sea 1 vez
  const seen = db.getSetting("ui:trayHintSeen", false);
  if (seen) return;

  db.setSetting("ui:trayHintSeen", true);

  dialog.showMessageBox({
    type: "info",
    title: "Sigo activo en la bandeja",
    message: "Quote Bubbles sigue activo en la bandeja del sistema.",
    detail: "Busca el icono junto al reloj para abrir, mostrar una frase o salir.",
    buttons: ["Entendido"],
    defaultId: 0
  });
}

function showRandomQuoteNow() {
  const quote = db.pickRandomQuoteByTags(
    db.getSetting("app:mode", {}).tagIds || []
  ) || db.pickRandomQuote();

  if (quote) showOverlay({ quote });
}

function createTray() {
  const iconPath = path.join(__dirname, "assets", "tray.ico");
  tray = new Tray(iconPath);


  tray.setToolTip("Quote Bubbles");

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Abrir",
      click: () => showMain()
    },
    {
      label: "Mostrar frase ahora",
      click: () => showRandomQuoteNow()
    },
    { type: "separator" },
    {
      label: "Salir",
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
  tray.on("click", () => showMain());
}

app.whenReady().then(() => {
  createMainWindow();
  createOverlayWindow();
  createTray();

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

  // WINDOW
  ipcMain.handle("window:minimize", () => {
    if (mainWin) mainWin.minimize();
    return true;
  });
  ipcMain.handle("window:closeToTray", () => {
    if (mainWin) mainWin.hide();
    maybeShowTrayHint();
    return true;
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
  // No quit: se queda en tray
  // En Windows esto mantiene el proceso vivo
});

app.on("before-quit", () => {
  isQuitting = true;
});
