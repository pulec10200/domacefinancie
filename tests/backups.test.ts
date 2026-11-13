import { beforeEach, afterEach, it, expect } from "vitest";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { openDatabase, type FinanceDatabase } from "../packages/database";
import { FinanceService } from "../packages/core/service";
import { DocumentService } from "../packages/modules/documents";
import {
  BackupService,
  validateBackup,
  activeDataDirectory,
} from "../packages/modules/backups";
let temp: string;
let root: string;
let external: string;
let db: FinanceDatabase;
let backups: BackupService;
beforeEach(async () => {
  temp = await mkdtemp(join(tmpdir(), "finance-backup-"));
  root = join(temp, "app");
  external = join(temp, "external");
  await mkdir(root);
  await mkdir(external);
  db = openDatabase(join(root, "finance.db"));
  await new DocumentService(db, join(root, "documents"), "unused").initialize();
  backups = new BackupService(db, root, root);
});
afterEach(async () => {
  db.close();
  await rm(temp, { recursive: true, force: true });
});
it("restores both database and original documents into a new profile", async () => {
  const finance = new FinanceService(db);
  finance.addAccount({ name: "Savings", type: "savings", opening: 123456 });
  const path = join(temp, "invoice.pdf");
  const bytes = "%PDF-1.4\nSynthetic invoice";
  await writeFile(path, bytes);
  const docs = new DocumentService(db, join(root, "documents"), "unused");
  await docs.importFile(path);
  const backup = await backups.create(external);
  expect((await validateBackup(backup)).files).toHaveLength(2);
  finance.addAccount({ name: "Later account", type: "cash", opening: 900 });
  const profile = await backups.restore(backup);
  expect(await activeDataDirectory(root)).toBe(profile);
  expect(finance.snapshot().accounts).toHaveLength(2);
  const restored = openDatabase(join(profile, "finance.db"));
  try {
    expect(new FinanceService(restored).snapshot().accounts).toHaveLength(1);
    const doc = restored.prepare("SELECT path FROM documents").get() as {
      path: string;
    };
    expect(doc.path.startsWith(profile)).toBe(true);
    expect(await readFile(doc.path, "utf8")).toBe(bytes);
  } finally {
    restored.close();
  }
});
it("rejects tampered archive bytes without changing the active profile", async () => {
  const path = join(temp, "invoice.pdf");
  await writeFile(path, "%PDF-1.4\nSynthetic");
  await new DocumentService(db, join(root, "documents"), "unused").importFile(
    path,
  );
  const backup = await backups.create(external);
  const manifest = JSON.parse(
    await readFile(join(backup, "manifest.json"), "utf8"),
  );
  const entry = manifest.files.find(
    (f: { path: string }) => f.path !== "finance.db",
  );
  await writeFile(join(backup, entry.path), "corrupted");
  await expect(backups.restore(backup)).rejects.toThrow("Kontrolný súčet");
  expect(await activeDataDirectory(root)).toBe(root);
});
it("rejects traversal paths and backups inside live application data", async () => {
  await expect(backups.create(root)).rejects.toThrow();
  const backup = await backups.create(external);
  const path = join(backup, "manifest.json");
  const manifest = JSON.parse(await readFile(path, "utf8"));
  manifest.files.push({
    path: "../../outside",
    sha256: "a".repeat(64),
    size: 1,
  });
  await writeFile(path, JSON.stringify(manifest));
  await expect(backups.restore(backup)).rejects.toThrow();
  expect(await activeDataDirectory(root)).toBe(root);
});
it("refuses incomplete legacy backups with no integrity manifest", async () => {
  await writeFile(
    join(external, "manifest.json"),
    JSON.stringify({ version: 1 }),
  );
  await expect(backups.restore(external)).rejects.toThrow();
});
it("moves data into an external profile, preserving originals and rejecting recursive backups", async () => {
  new FinanceService(db).addAccount({
    name: "Saved",
    type: "cash",
    opening: 4321,
  });
  const backup = await backups.create(external);
  const profile = await backups.restore(backup, external);
  expect(await activeDataDirectory(root)).toBe(profile);
  const moved = openDatabase(join(profile, "finance.db"));
  try {
    expect(new FinanceService(moved).snapshot().accounts[0].balance).toBe(4321);
    await expect(
      new BackupService(moved, root, profile).create(profile),
    ).rejects.toThrow();
  } finally {
    moved.close();
  }
  expect(new FinanceService(db).snapshot().accounts[0].balance).toBe(4321);
});
