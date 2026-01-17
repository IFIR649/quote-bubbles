const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  quotes: {
    list: () => ipcRenderer.invoke("quotes:list"),
    add: (q) => ipcRenderer.invoke("quotes:add", q),
    delete: (id) => ipcRenderer.invoke("quotes:delete", id),
    bulkImport: (rows) => ipcRenderer.invoke("quotes:bulkImport", rows),
  },
  tags: {
    list: () => ipcRenderer.invoke("tags:list"),
    add: (name) => ipcRenderer.invoke("tags:add", name),
    delete: (id) => ipcRenderer.invoke("tags:delete", id),
  },
  settings: {
    get: (key, fallback) => ipcRenderer.invoke("settings:get", key, fallback),
    set: (key, value) => ipcRenderer.invoke("settings:set", key, value),
  },
  scheduler: {
    resync: () => ipcRenderer.invoke("scheduler:resync"),
  },
  queue: {
    list: () => ipcRenderer.invoke("queue:list"),
    add: (quoteId) => ipcRenderer.invoke("queue:add", quoteId),
    remove: (queueId) => ipcRenderer.invoke("queue:remove", queueId),
    clear: () => ipcRenderer.invoke("queue:clear"),
    next: () => ipcRenderer.invoke("queue:next"),
  },
  overlay: {
    push: (payload) => ipcRenderer.invoke("overlay:push", payload),
    pushNextFromQueue: () => ipcRenderer.invoke("overlay:pushNextFromQueue"),
    hide: () => ipcRenderer.invoke("overlay:hide"),
    onShow: (cb) => {
      const handler = (_, payload) => cb(payload);
      ipcRenderer.on("overlay:show", handler);
      return () => ipcRenderer.removeListener("overlay:show", handler);
    }
  }
});
