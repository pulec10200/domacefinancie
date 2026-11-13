import { contextBridge, ipcRenderer } from "electron";
import type { DesktopApi } from "../../../../packages/contracts";
const api: DesktopApi = {
  restoreBackup: () => ipcRenderer.invoke("backup:restore"),
  confirmDocument: (v) => ipcRenderer.invoke("document:confirm", v),
  snapshot: () => ipcRenderer.invoke("snapshot"),
  addAccount: (v) => ipcRenderer.invoke("account:add", v),
  addTransaction: (v) => ipcRenderer.invoke("transaction:add", v),
  addRule: (v) => ipcRenderer.invoke("rule:add", v),
  pay: (v) => ipcRenderer.invoke("payable:pay", v),
  importDocument: () => ipcRenderer.invoke("document:import"),
  watchFolder: () => ipcRenderer.invoke("folder:watch"),
  backup: () => ipcRenderer.invoke("backup"),
  openDocument: (id) => ipcRenderer.invoke("document:open", id),
  openEkasa: () => ipcRenderer.invoke("ekasa:open"),
};
contextBridge.exposeInMainWorld("finance", api);
