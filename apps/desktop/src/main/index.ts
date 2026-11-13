import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  shell,
  Notification,
} from "electron";
import { join, resolve } from "node:path";
import { mkdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { openDatabase } from "../../../../packages/database";
import { FinanceService } from "../../../../packages/core/service";
import {
  BackupService,
  activeDataDirectory,
  validateBackup,
} from "../../../../packages/modules/backups";
import {
  DocumentService,
  LocalFolderSource,
} from "../../../../packages/modules/documents";
const here = __dirname;
let win: BrowserWindow;
let folder: LocalFolderSource | undefined;
let ticking = false;
if (process.env.NODE_ENV === "test" && process.env.FINANCE_TEST_DATA)
  app.setPath("userData", process.env.FINANCE_TEST_DATA);
if (!app.requestSingleInstanceLock()) app.quit();
app.on("second-instance", () => {
  win?.show();
  win?.focus();
});
app
  .whenReady()
  .then(async () => {
    const root = app.getPath("userData");
    await mkdir(root, { recursive: true });
    const dataDirectory = await activeDataDirectory(root);
    const db = openDatabase(join(dataDirectory, "finance.db"));
    const backups = new BackupService(db, root, dataDirectory);
    const service = new FinanceService(db);
    const documents = new DocumentService(
      db,
      join(dataDirectory, "documents"),
      app.isPackaged
        ? join(process.resourcesPath, "ocr")
        : resolve("assets/ocr"),
    );
    await documents.initialize();
    const register = (name: string, fn: (input: unknown) => unknown) =>
      ipcMain.handle(name, async (event, input) => {
        if (
          event.sender !== win.webContents ||
          event.senderFrame !== win.webContents.mainFrame
        )
          throw Error("Forbidden IPC sender");
        return fn(input);
      });
    register("document:confirm", (v) => service.confirmDocument(v));
    register("snapshot", () => service.snapshot());
    register("account:add", (v) => service.addAccount(v));
    register("transaction:add", (v) => service.addTransaction(v));
    register("rule:add", (v) => service.addRule(v));
    register("payable:pay", (v) => service.pay(v));
    register("document:import", async () => {
      const result = await dialog.showOpenDialog(win, {
        properties: ["openFile", "multiSelections"],
        filters: [
          {
            name: "Dokumenty",
            extensions: ["pdf", "png", "jpg", "jpeg", "webp"],
          },
        ],
      });
      if (!result.canceled)
        for (const path of result.filePaths) await documents.importFile(path);
    });
    register("document:open", async (input) => {
      const id = z.string().uuid().parse(input);
      const doc = db
        .prepare("SELECT path FROM documents WHERE id=?")
        .get(id) as { path: string } | undefined;
      if (!doc) throw Error("Dokument sa nenašiel");
      const result = await shell.openPath(doc.path);
      if (result) throw Error(result);
    });
    register("ekasa:open", () =>
      shell.openExternal("https://opd.financnasprava.sk/"),
    );
    register("folder:watch", async () => {
      const result = await dialog.showOpenDialog(win, {
        properties: ["openDirectory"],
      });
      if (result.canceled) return null;
      await folder?.stop();
      const path = result.filePaths[0];
      folder = new LocalFolderSource(path, documents, () => {
        if (Notification.isSupported())
          new Notification({
            title: "Import dokumentov",
            body: "Sledovanie priečinka zaznamenalo chybu. Skontrolujte priečinok.",
          }).show();
      });
      await folder.start();
      db.prepare("INSERT OR REPLACE INTO settings VALUES('watchFolder',?)").run(
        path,
      );
      return path;
    });
    register("backup", async () => {
      const result = await dialog.showOpenDialog(win, {
        properties: ["openDirectory", "createDirectory"],
      });
      if (result.canceled) return null;
      return backups.create(result.filePaths[0]);
    });
    register("backup:restore", async () => {
      const result = await dialog.showOpenDialog(win, {
        properties: ["openDirectory"],
        title: "Vyberte kompletný priečinok zálohy",
      });
      if (result.canceled) return;
      await validateBackup(result.filePaths[0]);
      const confirmation = await dialog.showMessageBox(win, {
        type: "warning",
        buttons: ["Zrušiť", "Obnoviť a reštartovať"],
        defaultId: 0,
        cancelId: 0,
        title: "Obnova zálohy",
        message: "Aktívne údaje sa nahradia obsahom zvolenej zálohy.",
        detail:
          "Pôvodné údaje zostanú zachované v samostatnom dátovom profile. Aplikácia sa po obnove reštartuje.",
      });
      if (confirmation.response !== 1) return;
      await folder?.stop();
      await backups.restore(result.filePaths[0]);
      app.relaunch();
      app.exit(0);
    });
    const saved = db
      .prepare("SELECT value FROM settings WHERE key='watchFolder'")
      .get() as { value: string } | undefined;
    if (saved) {
      folder = new LocalFolderSource(saved.value, documents, () => {});
      await folder.start();
    }
    win = new BrowserWindow({
      width: 1280,
      height: 850,
      minWidth: 900,
      minHeight: 650,
      title: "Domáce Financie",
      webPreferences: {
        preload: join(here, "../preload/index.js"),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
      },
    });
    win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    win.webContents.on("will-navigate", (e) => e.preventDefault());
    win.webContents.session.setPermissionRequestHandler(
      (_wc, _permission, callback) => callback(false),
    );
    if (process.env.ELECTRON_RENDERER_URL && !app.isPackaged)
      await win.loadURL(process.env.ELECTRON_RENDERER_URL);
    else await win.loadFile(join(here, "../renderer/index.html"));
    const timer = setInterval(async () => {
      if (ticking) return;
      ticking = true;
      try {
        await documents.processNext();
        const now = new Date().toISOString().slice(0, 10);
        for (const p of service.snapshot(now).payables) {
          if (p.paid >= p.amount) continue;
          const days = Math.round(
            (+new Date(p.due) - +new Date(now)) / 86400000,
          );
          if (![14, 7, 3, 1, 0].includes(days) && days > 0) continue;
          if (Notification.isSupported()) {
            const id = randomUUID();
            const added = db
              .prepare("INSERT OR IGNORE INTO notifications VALUES(?,?,?)")
              .run(id, p.id, now);
            if (added.changes)
              new Notification({
                title: "Blíži sa splatnosť",
                body: p.name + " • " + p.due,
              }).show();
          }
        }
      } finally {
        ticking = false;
      }
    }, 3000);
    app.on("before-quit", () => {
      clearInterval(timer);
      void folder?.stop();
    });
  })
  .catch((error) => {
    dialog.showErrorBox(
      "Domáce Financie — chyba spustenia",
      error instanceof Error
        ? error.message
        : "Aplikáciu sa nepodarilo spustiť.",
    );
    app.quit();
  });
app.on("window-all-closed", () => app.quit());
