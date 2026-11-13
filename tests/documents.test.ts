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
it.each(["Verified", "NotFound", "Unavailable"] as const)(
  "keeps QR verification %s separate from OCR and retains the original",
  async (status) => {
    const { default: QRCode } = await import("qrcode");
    const { ExtractionService } =
      await import("../packages/modules/extraction");
    const extraction = new ExtractionService(db);
    const image = join(dir, "qr.png");
    const qr = await QRCode.toBuffer("SYNTHETIC-OFFLINE-RECEIPT", {
      width: 260,
      margin: 4,
    });
    await sharp(
      Buffer.from(
        '<svg width="1000" height="500"><rect width="100%" height="100%" fill="white"/><text x="30" y="90" font-size="50" font-family="sans-serif">Receipt TOTAL 12.34 EUR</text></svg>',
      ),
    )
      .composite([{ input: qr, left: 700, top: 200 }])
      .png()
      .toFile(image);
    const seen: string[] = [];
    docs = new DocumentService(
      db,
      join(dir, "docs"),
      join(process.cwd(), "assets/ocr"),
      {
        verify: async (value) => {
          seen.push(value);
          if (status === "Unavailable") throw Error("offline");
          return { status, amount: status === "Verified" ? 1400 : undefined };
        },
      },
      (id, text, source, v) => extraction.propose(id, text, source, v),
    );
    const id = await docs.importFile(image);
    await docs.processNext();
    expect(seen).toEqual(["SYNTHETIC-OFFLINE-RECEIPT"]);
    const row = db
      .prepare("SELECT status,ekasa,text,path FROM documents WHERE id=?")
      .get(id) as any;
    expect(row.status).toBe("needs_review");
    expect(row.ekasa).toBe(status);
    expect(row.text).toContain("12.34");
    expect(await readFile(row.path)).toEqual(await readFile(image));
    const amounts = extraction.list().filter((f) => f.field === "amount");
    expect(amounts.some((f) => f.value === 1234)).toBe(true);
    if (status === "Verified") {
      expect(
        amounts.some((f) => f.value === 1400 && f.source === "ekasa"),
      ).toBe(true);
    }
  },
  30000,
);
it("extracts text-layer PDF before OCR and can preview its original page", async () => {
  const { textPDF } = await import("./pdf-fixture");
  const { ExtractionService } = await import("../packages/modules/extraction");
  const extraction = new ExtractionService(db);
  docs = new DocumentService(
    db,
    join(dir, "docs"),
    "deliberately-missing-models",
    undefined,
    (id, text, source, v) => extraction.propose(id, text, source, v),
  );
  const path = join(dir, "invoice.pdf");
  await writeFile(
    path,
    textPDF(["Invoice", "TOTAL 25.00 EUR", "Due date: 2026-11-20"]),
  );
  const id = await docs.importFile(path);
  await docs.processNext();
  expect((docs.list()[0] as any).status).toBe("needs_review");
  expect(extraction.list()).toContainEqual(
    expect.objectContaining({ field: "amount", value: 2500 }),
  );
  const preview = await docs.preview(id, 1);
  expect(preview.pages).toBe(1);
  expect(preview.image).toMatch(/^data:image\/png;base64,/);
});
it("does not reprocess a document confirmed while its job was pending", async () => {
  const path = join(dir, "pending.pdf");
  await writeFile(path, "%PDF-1.4\nSynthetic");
  const id = await docs.importFile(path);
  docs.complete(id, "contract", id);
  await docs.processNext();
  expect((docs.list()[0] as any).status).toBe("confirmed");
});
it("matches an invoice to its recurring period even when actual due date changes", async () => {
  const { FinanceService } = await import("../packages/core/service");
  const service = new FinanceService(db);
  service.addRule({
    name: "Phone",
    amount: 2000,
    start: "2026-11-01",
    interval: 1,
  });
  const first = service.snapshot("2026-11-13").payables[0];
  const path = join(dir, "bill.pdf");
  await writeFile(path, "%PDF-1.4\nSynthetic");
  const documentId = await docs.importFile(path);
  const id = service.confirmDocument({
    documentId,
    kind: "invoice",
    payableId: first.id,
    name: "Phone actual",
    amount: 2500,
    date: "2026-11-20",
  });
  expect(id).toBe(first.id);
  const snapshot = service.snapshot("2026-11-13");
  expect(
    snapshot.payables.filter((p) => p.due.startsWith("2026-11")),
  ).toHaveLength(1);
  expect(snapshot.payables.find((p) => p.id === id)).toMatchObject({
    estimated_amount: 2000,
    amount: 2500,
    due: "2026-11-20",
  });
  expect(snapshot.monthly[0].unpaid).toBe(2500);
});
it("fails missing offline OCR models promptly, preserves the original and permits retry", async () => {
  const path = join(dir, "missing-ocr.png");
  await sharp({
    create: { width: 100, height: 100, channels: 3, background: "white" },
  })
    .png()
    .toFile(path);
  const id = await docs.importFile(path);
  await docs.processNext();
  const row = db
    .prepare("SELECT path,status,error FROM documents WHERE id=?")
    .get(id) as any;
  expect(row.status).toBe("failed");
  expect(row.error).toContain("OCR model");
  expect(await readFile(row.path)).toEqual(await readFile(path));
  docs.retry(id);
  expect((docs.list()[0] as any).status).toBe("pending");
});
