import { it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { openDatabase, type FinanceDatabase } from "../packages/database";
import {
  DocumentService,
  ManualEkasaProvider,
} from "../packages/modules/documents";
let dir: string;
let db: FinanceDatabase;
let docs: DocumentService;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "document-test-"));
  db = openDatabase(join(dir, "test.db"));
  docs = new DocumentService(
    db,
    join(dir, "docs"),
    join(dir, "missing-languages"),
  );
  await docs.initialize();
});
afterEach(async () => {
  db.close();
  await rm(dir, { recursive: true, force: true });
});
it("imports images once and preserves original bytes", async () => {
  const path = join(dir, "receipt.png");
  await sharp({
    create: { width: 20, height: 20, channels: 3, background: "white" },
  })
    .png()
    .toFile(path);
  const id = await docs.importFile(path);
  expect(await docs.importFile(path)).toBe(id);
  expect(db.prepare("SELECT * FROM processing_jobs").all()).toHaveLength(1);
  const row = db.prepare("SELECT path FROM documents WHERE id=?").get(id) as {
    path: string;
  };
  expect(await readFile(row.path)).toEqual(await readFile(path));
});
it("rejects unsupported and disguised files", async () => {
  const path = join(dir, "fake.png");
  await writeFile(path, "not an image");
  await expect(docs.importFile(path)).rejects.toThrow();
  const exe = join(dir, "file.exe");
  await writeFile(exe, "fake");
  await expect(docs.importFile(exe)).rejects.toThrow();
});
it("rejects incomplete empty files without creating a job", async () => {
  const path = join(dir, "empty.pdf");
  await writeFile(path, "");
  await expect(docs.importFile(path)).rejects.toThrow();
  expect(db.prepare("SELECT * FROM processing_jobs").all()).toHaveLength(0);
});
it("recovers interrupted running jobs on restart", async () => {
  const path = join(dir, "doc.pdf");
  await writeFile(path, "%PDF-1.4\ninvalid test fixture");
  await docs.importFile(path);
  db.prepare("UPDATE processing_jobs SET status='running'").run();
  await docs.initialize();
  expect(db.prepare("SELECT status FROM processing_jobs").get()).toEqual({
    status: "pending",
  });
  await docs.processNext();
  expect(db.prepare("SELECT status FROM documents").get()).toEqual({
    status: "failed",
  });
  expect(await readFile(path, "utf8")).toContain("%PDF-");
});
it("never claims automatic eKasa verification", async () => {
  expect(await new ManualEkasaProvider().verify()).toEqual({
    status: "RequiresManualVerification",
  });
});
it("confirms an invoice once and updates the dashboard", async () => {
  const { FinanceService } = await import("../packages/core/service");
  const service = new FinanceService(db);
  const path = join(dir, "invoice.pdf");
  await writeFile(path, "%PDF-1.4\nfixture");
  const documentId = await docs.importFile(path);
  const input = {
    documentId,
    kind: "invoice",
    name: "Internet",
    amount: 2500,
    date: "2026-11-20",
  };
  const id = service.confirmDocument(input);
  expect(service.confirmDocument(input)).toBe(id);
  expect(service.snapshot("2026-11-13").monthly[0].unpaid).toBe(2500);
  expect(db.prepare("SELECT status FROM processing_jobs").get()).toEqual({
    status: "completed",
  });
});
it("confirms a receipt as a single expense", async () => {
  const { FinanceService } = await import("../packages/core/service");
  const service = new FinanceService(db);
  const accountId = service.addAccount({
    name: "Cash",
    type: "cash",
    opening: 10000,
  });
  const path = join(dir, "receipt.pdf");
  await writeFile(path, "%PDF-1.4\nfixture");
  const documentId = await docs.importFile(path);
  const input = {
    documentId,
    kind: "receipt",
    name: "Groceries",
    amount: 1234,
    date: "2026-11-13",
    accountId,
  };
  service.confirmDocument(input);
  service.confirmDocument(input);
  expect(service.snapshot("2026-11-13").transactions).toHaveLength(1);
  expect(service.snapshot("2026-11-13").accounts[0].balance).toBe(8766);
});
it("recognizes a synthetic image with bundled offline OCR models", async () => {
  docs = new DocumentService(
    db,
    join(dir, "docs"),
    join(process.cwd(), "assets/ocr"),
  );
  const image = join(dir, "ocr.png");
  await sharp(
    Buffer.from(
      '<svg width="900" height="200"><rect width="100%" height="100%" fill="white"/><text x="40" y="100" font-size="60" font-family="sans-serif" fill="black">TOTAL 12.34 EUR</text></svg>',
    ),
  )
    .png()
    .toFile(image);
  const id = await docs.importFile(image);
  await docs.processNext();
  const row = db
    .prepare("SELECT status,text,error FROM documents WHERE id=?")
    .get(id) as { status: string; text: string; error: string | null };
  expect(row.error).toBeNull();
  expect(row.status).toBe("needs_review");
  expect(row.text).toContain("12.34");
}, 30000);
