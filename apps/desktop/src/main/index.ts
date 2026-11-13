import { SettingsService } from "../../../../packages/modules/settings";
import { preferences as preferencesSchema } from "../../../../packages/contracts/settings";
import { localDate } from "../../../../packages/contracts/primitives";
import { configureStartup } from "./startup";
import { DocumentProcessor } from "./documentProcessor";
import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  shell,
  Notification,
  safeStorage,
  Tray,
  Menu,
  nativeImage,
} from "electron";
import { join, resolve } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { openDatabase, exportDatabase } from "../../../../packages/database";
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
import { ExtractionService } from "../../../../packages/modules/extraction";
import { confirmationInput } from "../../../../packages/contracts";
import { DomainService } from "../../../../packages/modules/domain";
import {
  contractConfirmation,
  ruleChange,
} from "../../../../packages/contracts/domain";
import { AIProviderManager } from "../../../../packages/modules/ai";
import { aiTask } from "../../../../packages/contracts/ai";
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
    const settings = new SettingsService(db);
    let preferences = settings.preferences();
    let tray: Tray | undefined;
    let quitting = false;
    const updateTray = () => {
      if (preferences.background && !tray) {
        const pixels = Buffer.alloc(16 * 16 * 4);
        for (let i = 0; i < 256; i++) {
          pixels[i * 4] = 35;
          pixels[i * 4 + 1] = 130;
          pixels[i * 4 + 2] = 85;
          pixels[i * 4 + 3] = 255;
        }
        tray = new Tray(
          nativeImage.createFromBitmap(pixels, { width: 16, height: 16 }),
        );
        tray.setToolTip("Domáce Financie");
        tray.setContextMenu(
          Menu.buildFromTemplate([
            {
              label: "Otvoriť Domáce Financie",
              click: () => {
                win.show();
                win.focus();
              },
            },
            {
              label: "Ukončiť",
              click: () => {
                quitting = true;
                app.quit();
              },
            },
          ]),
        );
        tray.on("click", () => win.show());
      } else if (!preferences.background && tray) {
        tray.destroy();
        tray = undefined;
      }
    };

    const domain = new DomainService(
      db,
      () => service.snapshot(),
      () => service.listRules(),
    );
    const extractions = new ExtractionService(db);
    const ai = new AIProviderManager(db, {
      available: () =>
        safeStorage.isEncryptionAvailable() &&
        (process.platform !== "linux" ||
          safeStorage.getSelectedStorageBackend() !== "basic_text"),
      encrypt: (v) => safeStorage.encryptString(v),
      decrypt: (v) => safeStorage.decryptString(v),
    });
    const documents = new DocumentService(
      db,
      join(dataDirectory, "documents"),
      app.isPackaged
        ? join(process.resourcesPath, "ocr")
        : resolve("assets/ocr"),
      undefined,
      (id, text, source, verification) =>
        extractions.propose(id, text, source, verification),
    );
    await documents.initialize();
    const processor = new DocumentProcessor(
      join(here, "documentWorker.js"),
      dataDirectory,
      app.isPackaged
        ? join(process.resourcesPath, "ocr")
        : resolve("assets/ocr"),
      (message) => documents.interrupted(message),
    );
    const register = (name: string, fn: (input: unknown) => unknown) =>
      ipcMain.handle(name, async (event, input) => {
        if (
          event.sender !== win.webContents ||
          event.senderFrame !== win.webContents.mainFrame
        )
          throw Error("Forbidden IPC sender");
        return fn(input);
      });
    register("settings", () => ({
      preferences: settings.preferences(),
      startupSupported:
        app.isPackaged && ["linux", "win32"].includes(process.platform),
      watchFolder: settings.get("watchFolder"),
      lastBackup: settings.get("lastBackup"),
      dataDirectory,
    }));
    register("settings:data-directory", async () => {
      const selected = await dialog.showOpenDialog(win, {
        title: "Nové umiestnenie dát",
        properties: ["openDirectory", "createDirectory"],
      });
      if (selected.canceled) return;
      const answer = await dialog.showMessageBox(win, {
        type: "question",
        buttons: ["Zrušiť", "Skopírovať dáta a reštartovať"],
        defaultId: 0,
        cancelId: 0,
        message: "Vytvoriť overenú kópiu dát vo vybranom priečinku?",
        detail:
          "Pôvodné dáta zostanú zachované. Na novom mieste sa vytvorí pracovný profil aj overená záloha; potrebujete miesto pre dve kópie.",
      });
      if (answer.response !== 1) return;
      const backup = await backups.create(selected.filePaths[0]);
      await backups.restore(backup, selected.filePaths[0]);
      await folder?.stop();
      processor.stop();
      app.relaunch();
      app.exit(0);
    });
    register("settings:save", async (input) => {
      const next = preferencesSchema.parse(input);
      await configureStartup(next.startAtLogin);
      preferences = settings.save(next);
      updateTray();
    });
    register("ai:state", () => ai.state());
    register("ai:save", (v) => ai.save(v));
    register("ai:route", (v) => ai.saveRoute(v));
    register("ai:test", (v) => ai.test(z.string().uuid().parse(v)));
    register("ai:document", async (v) => {
      const input = z
        .object({
          documentId: z.string().uuid(),
          task: aiTask,
          approvedProviders: z.array(z.string().uuid()).max(10),
        })
        .parse(v);
      const result = await ai.run(
        input.task,
        documents.getText(input.documentId),
        input.approvedProviders,
      );
      extractions.addAI(input.documentId, result.providerId, result.output);
    });
    register("contract:confirm", (input) => {
      const v = contractConfirmation.parse(input);
      return db.transaction(() => {
        const prior = documents.confirmation(v.documentId);
        if (prior) {
          if (prior.kind !== "contract")
            throw Error("Dokument už bol potvrdený ako finančný doklad.");
          return prior.entity_id;
        }
        documents.assertConfirmable(v.documentId);
        const id = domain.saveContract({
          ...v.contract,
          id: v.documentId,
          documentId: v.documentId,
        });
        if (v.rule)
          service.addRule({
            ...v.rule,
            contractId: id,
            assetId: v.contract.assetId ?? v.rule.assetId,
          });
        documents.complete(v.documentId, "contract", id);
        extractions.confirm(v.documentId, {
          name: v.contract.name,
          contract: v.contract.details,
          ...(v.rule
            ? {
                amount: v.rule.amount,
                date: v.rule.start,
                interval: v.rule.interval,
              }
            : {}),
        });
        return id;
      })();
    });
    register("domain:snapshot", () => domain.snapshot());
    register("asset:save", (v) => domain.saveAsset(v));
    register("contract:save", (v) => domain.saveContract(v));
    register("category:save", (v) => domain.saveCategory(v));
    register("budget:save", (v) => domain.saveBudget(v));
    register("entity:archive", (v) => {
      const input = z
        .object({
          kind: z.enum(["asset", "contract", "account"]),
          archived: z.boolean().default(true),
          id: z.string().uuid(),
        })
        .parse(v);
      if (input.kind === "account")
        service.archiveAccount(input.id, input.archived);
      else domain.archive(input.kind, input.id, input.archived);
    });
    register("payable:cancel", (v) =>
      service.cancelPayable(z.string().uuid().parse(v)),
    );
    register("rule:stop", (v) => service.stopRule(z.string().uuid().parse(v)));
    register("rule:change", (v) => service.changeRule(ruleChange.parse(v)));
    register("transaction:void", (v) =>
      service.voidTransaction(z.string().uuid().parse(v)),
    );
    register("document:confirm", (v) => {
      const input = confirmationInput.parse(v);
      return db.transaction(() => {
        const prior = documents.confirmation(input.documentId);
        if (prior) return prior.entity_id;
        documents.assertConfirmable(input.documentId);
        const result = service.confirmDocument(input);
        extractions.confirm(input.documentId, {
          amount: input.amount,
          date: input.date,
          name: input.name,
        });
        return result;
      })();
    });
    register("receipt:items", (id) =>
      documents.receiptItems(z.string().uuid().parse(id)),
    );
    register("receipt:save", (input) =>
      db.transaction(() => {
        const v = documents.saveReceiptItems(input);
        extractions.confirm(v.documentId, { items: v.items });
      })(),
    );
    register("extractions", () => extractions.list());
    register("document:cancel", (v) => {
      const id = z.string().uuid().parse(v);
      if (!documents.isRunning(id))
        throw Error("Dokument sa práve nespracúva.");
      processor.cancel();
    });
    register("document:retry", (v) =>
      documents.retry(z.string().uuid().parse(v)),
    );
    register("document:preview", (v) => {
      const input = z
        .object({
          documentId: z.string().uuid(),
          page: z.number().int().min(1).max(100),
        })
        .parse(v);
      return processor.preview(input.documentId, input.page);
    });
    register("snapshot", () => ({
      ...service.snapshot(),
      documents: documents.list(),
    }));
    register("account:update", (v) => service.updateAccount(v));
    register("transaction:update", (v) => service.updateTransaction(v));
    register("transaction:restore", (v) =>
      service.restoreTransaction(z.string().uuid().parse(v)),
    );
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
    register("ekasa:manual", (v) => {
      const input = z
        .object({
          documentId: z.string().uuid(),
          result: z.enum(["matched", "not_found", "mismatch"]),
        })
        .parse(v);
      extractions.confirm(input.documentId, {
        manualVerification: {
          result: input.result,
          checkedAt: new Date().toISOString(),
          source: "https://opd.financnasprava.sk/",
          attestedBy: "user",
        },
      });
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
    register("export", async () => {
      const result = await dialog.showSaveDialog(win, {
        title: "Export všetkých údajov do JSON (bez API kľúčov)",
        defaultPath: "domace-financie-export.json",
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (result.canceled || !result.filePath) return null;
      const data = exportDatabase(db);
      await writeFile(result.filePath, JSON.stringify(data, null, 2), {
        mode: 0o600,
      });
      return result.filePath;
    });
    register("backup", async () => {
      const result = await dialog.showOpenDialog(win, {
        properties: ["openDirectory", "createDirectory"],
      });
      if (result.canceled) return null;
      const path = await backups.create(result.filePaths[0]);
      settings.set("lastBackup", new Date().toISOString());
      return path;
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
      await backups.restore(result.filePaths[0]);
      await folder?.stop();
      processor.stop();
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
    updateTray();
    win.on("close", (event) => {
      if (preferences.background && !quitting) {
        event.preventDefault();
        win.hide();
      }
    });
    app.on("before-quit", () => {
      quitting = true;
    });
    app.on("activate", () => win.show());
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
        processor.schedule();
        const now = localDate();
        for (const p of service.snapshot(now).payables) {
          if (
            !settings.shouldNotify(
              p.due,
              p.paid,
              p.amount,
              Boolean(p.cancelled),
              now,
            )
          )
            continue;
          if (Notification.isSupported()) {
            const id = randomUUID();
            if (settings.claimNotification(p.id, now, id))
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
      processor.stop();
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
