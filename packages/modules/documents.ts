import { z } from "zod";
import { money } from "../contracts/primitives";
import { randomUUID, createHash } from "node:crypto";
import { mkdir, readFile, copyFile, stat, readdir } from "node:fs/promises";
import { constants } from "node:fs";
import { join, extname, basename } from "node:path";
import type { FinanceDatabase } from "../database";
import { validateImage, imageCanvas } from "./images";
import jsQR from "jsqr";
import { createCanvas } from "@napi-rs/canvas";
import { createWorker } from "tesseract.js";
import { watch, type FSWatcher } from "chokidar";
export type EkasaStatus =
  | "Verified"
  | "NotFound"
  | "Unavailable"
  | "NotSupported"
  | "NotAttempted"
  | "RequiresManualVerification";
export interface EkasaProvider {
  verify(
    qr: string,
  ): Promise<{ status: EkasaStatus; amount?: number; merchant?: string }>;
}
export class ManualEkasaProvider implements EkasaProvider {
  async verify(): Promise<{ status: EkasaStatus }> {
    return { status: "RequiresManualVerification" };
  }
}
import type { DocumentSourceAdapter } from "../contracts/sources";
export type { DocumentSourceAdapter } from "../contracts/sources";
export class DocumentService {
  busy = false;
  private ocrWorker?: Awaited<ReturnType<typeof createWorker>>;
  private currentJob: string | null = null;
  private progressBase = 0;
  private progressSpan = 90;
  list() {
    return this.db
      .prepare(
        "SELECT d.id,d.name,d.status,d.ekasa,d.error,d.text,COALESCE(j.progress,0) progress,j.attempts FROM documents d LEFT JOIN processing_jobs j ON j.document_id=d.id ORDER BY d.rowid DESC",
      )
      .all();
  }
  isRunning(id: string) {
    return Boolean(
      this.db
        .prepare(
          "SELECT id FROM processing_jobs WHERE document_id=? AND status='running'",
        )
        .get(id),
    );
  }

  constructor(
    readonly db: FinanceDatabase,
    readonly root: string,
    readonly languages: string,
    readonly ekasa: EkasaProvider = new ManualEkasaProvider(),
    readonly onText?: (
      id: string,
      text: string,
      source: string,
      verification?: { status: string; amount?: number; merchant?: string },
    ) => void,
  ) {}
  async initialize() {
    for (const folder of [
      "Inbox",
      "Processed",
      "NeedsReview",
      "Archive",
      "Failed",
    ])
      await mkdir(join(this.root, folder), { recursive: true });
    this.db
      .prepare(
        "UPDATE documents SET status='pending' WHERE id IN (SELECT document_id FROM processing_jobs WHERE status='running')",
      )
      .run();
    this.db
      .prepare(
        "UPDATE processing_jobs SET status='pending' WHERE status='running'",
      )
      .run();
  }
  async importFile(source: string) {
    const before = await stat(source);
    if (!before.isFile() || before.size > 30 * 1024 * 1024 || before.size === 0)
      throw Error("Súbor je prázdny alebo presahuje 30 MB.");
    const ext = extname(source).toLowerCase();
    if (![".pdf", ".png", ".jpg", ".jpeg", ".webp"].includes(ext))
      throw Error("Nepodporovaný formát dokumentu.");
    const bytes = await readFile(source);
    const after = await stat(source);
    if (before.size !== after.size || before.mtimeMs !== after.mtimeMs)
      throw Error("Súbor sa ešte kopíruje.");
    if (ext === ".pdf") {
      if (bytes.subarray(0, 5).toString() !== "%PDF-")
        throw Error("Neplatný PDF súbor.");
    } else {
      validateImage(bytes);
    }
    const hash = createHash("sha256").update(bytes).digest("hex");
    const old = this.db
      .prepare("SELECT id FROM documents WHERE hash=?")
      .get(hash) as { id: string } | undefined;
    if (old) return old.id;
    const id = randomUUID();
    const destination = join(this.root, "Archive", hash + ext);
    await copyFile(source, destination, constants.COPYFILE_EXCL).catch(
      async (e) => {
        if (e.code !== "EEXIST") throw e;
        const existing = await readFile(destination);
        if (createHash("sha256").update(existing).digest("hex") !== hash)
          throw Error("Archive integrity failure");
      },
    );
    this.db.transaction(() => {
      this.db
        .prepare(
          "INSERT INTO documents(id,name,path,hash,status) VALUES(?,?,?,?,'pending')",
        )
        .run(id, basename(source), destination, hash);
      this.db
        .prepare(
          "INSERT INTO processing_jobs(id,document_id,status) VALUES(?,?,'pending')",
        )
        .run(randomUUID(), id);
    })();
    return id;
  }
  private async recognize(input: string | Buffer) {
    if (!this.ocrWorker)
      this.ocrWorker = await createWorker(["slk", "eng"], 1, {
        langPath: this.languages,
        cacheMethod: "none",
        gzip: true,
        logger: (message) => {
          if (
            this.currentJob &&
            message.status === "recognizing text" &&
            typeof message.progress === "number"
          )
            this.db
              .prepare("UPDATE processing_jobs SET progress=? WHERE id=?")
              .run(
                Math.floor(
                  this.progressBase + this.progressSpan * message.progress,
                ),
                this.currentJob,
              );
        },
      });
    return (await this.ocrWorker.recognize(input)).data.text;
  }
  private async verify(
    qr: string | null,
  ): Promise<{ status: EkasaStatus; amount?: number; merchant?: string }> {
    if (!qr) return { status: "NotAttempted" };
    try {
      return await this.ekasa.verify(qr);
    } catch {
      return { status: "Unavailable" };
    }
  }
  confirmation(id: string) {
    return this.db
      .prepare(
        "SELECT kind,entity_id FROM document_confirmations WHERE document_id=?",
      )
      .get(id) as { kind: string; entity_id: string } | undefined;
  }
  assertConfirmable(id: string) {
    const row = this.db
      .prepare("SELECT status FROM documents WHERE id=?")
      .get(id) as { status: string } | undefined;
    if (!row) throw Error("Dokument neexistuje.");
    if (row.status === "running")
      throw Error("Počkajte na dokončenie spracovania alebo ho prerušte.");
  }
  complete(id: string, kind: string, entityId: string) {
    this.db
      .prepare("INSERT INTO document_confirmations VALUES(?,?,?)")
      .run(id, kind, entityId);
    this.db
      .prepare("UPDATE documents SET status='confirmed' WHERE id=?")
      .run(id);
    this.db
      .prepare(
        "UPDATE processing_jobs SET status='completed',progress=100 WHERE document_id=?",
      )
      .run(id);
  }
  receiptItems(documentId: string) {
    return (
      this.db
        .prepare(
          "SELECT name,quantity,amount FROM receipt_items WHERE document_id=? ORDER BY rowid",
        )
        .all(documentId) as {
        name: string;
        quantity: string | null;
        amount: number | null;
      }[]
    ).map((v) => ({
      name: v.name,
      quantity: v.quantity,
      amountCents: v.amount,
    }));
  }
  saveReceiptItems(input: unknown) {
    const v = z
      .object({
        documentId: z.string().uuid(),
        items: z
          .array(
            z.object({
              name: z.string().trim().min(1).max(500),
              quantity: z.string().max(50).nullable(),
              amountCents: money.nonnegative().nullable(),
            }),
          )
          .max(500),
      })
      .parse(input);
    this.db.transaction(() => {
      this.db
        .prepare("DELETE FROM receipt_items WHERE document_id=?")
        .run(v.documentId);
      for (const item of v.items)
        this.db
          .prepare("INSERT INTO receipt_items VALUES(?,?,?,?,?,?)")
          .run(
            randomUUID(),
            v.documentId,
            item.name,
            item.quantity,
            item.amountCents,
            "user",
          );
    })();
    return v;
  }
  interrupted(message: string) {
    this.db.transaction(() => {
      this.db
        .prepare(
          "UPDATE documents SET status='failed',error=? WHERE id IN (SELECT document_id FROM processing_jobs WHERE status='running')",
        )
        .run(message);
      this.db
        .prepare(
          "UPDATE processing_jobs SET status='failed' WHERE status='running'",
        )
        .run();
    })();
  }
  retry(id: string) {
    const row = this.db
      .prepare("SELECT status FROM documents WHERE id=?")
      .get(id) as { status: string } | undefined;
    if (!row) throw Error("Dokument neexistuje.");
    if (row.status === "running")
      throw Error("Najprv prerušte bežiace spracovanie.");
    if (row.status === "confirmed")
      throw Error(
        "Potvrdený dokument nemožno prepísať opakovaným spracovaním.",
      );
    this.db.transaction(() => {
      this.db
        .prepare(
          "UPDATE processing_jobs SET status='pending',progress=0,next_run_at=NULL WHERE document_id=? AND status!='running'",
        )
        .run(id);
      this.db
        .prepare(
          "UPDATE documents SET status='pending',error=NULL WHERE id=? AND status!='confirmed'",
        )
        .run(id);
    })();
  }
  async preview(id: string, page: number) {
    const row = this.db
      .prepare("SELECT path FROM documents WHERE id=?")
      .get(id) as { path: string } | undefined;
    if (!row) throw Error("Dokument neexistuje.");
    if (extname(row.path) !== ".pdf") {
      const canvas = await imageCanvas(await readFile(row.path), 1200, 1600);
      return {
        image:
          "data:image/png;base64," +
          canvas.toBuffer("image/png").toString("base64"),
        pages: 1,
      };
    }
    const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const task = getDocument({
      data: new Uint8Array(await readFile(row.path)),
      useSystemFonts: true,
    });
    const pdf = await task.promise;
    try {
      if (page > pdf.numPages) throw Error("Strana neexistuje.");
      const p = await pdf.getPage(page);
      const viewport = p.getViewport({ scale: 1.2 });
      if (viewport.width * viewport.height > 12000000)
        throw Error("Príliš veľká strana.");
      const canvas = createCanvas(
        Math.ceil(viewport.width),
        Math.ceil(viewport.height),
      );
      await p.render({
        canvas: null,
        canvasContext: canvas.getContext(
          "2d",
        ) as unknown as CanvasRenderingContext2D,
        viewport,
      }).promise;
      return {
        image:
          "data:image/png;base64," +
          canvas.toBuffer("image/png").toString("base64"),
        pages: pdf.numPages,
      };
    } finally {
      await task.destroy();
    }
  }
  getText(id: string) {
    const row = this.db
      .prepare("SELECT text FROM documents WHERE id=?")
      .get(id) as { text: string | null } | undefined;
    if (!row?.text) throw Error("Dokument ešte nemá rozpoznaný text.");
    return row.text;
  }
  async processNext() {
    if (this.busy) return;
    this.busy = true;
    try {
      const job = this.db
        .transaction(() => {
          const next = this.db
            .prepare(
              "SELECT j.id,j.document_id,d.path FROM processing_jobs j JOIN documents d ON d.id=j.document_id WHERE j.status='pending' AND d.status='pending' ORDER BY j.rowid LIMIT 1",
            )
            .get() as
            { id: string; document_id: string; path: string } | undefined;
          if (!next) return undefined;
          this.db
            .prepare(
              "UPDATE documents SET status='running',error=NULL WHERE id=?",
            )
            .run(next.document_id);
          this.db
            .prepare(
              "UPDATE processing_jobs SET status='running',attempts=attempts+1 WHERE id=?",
            )
            .run(next.id);
          return next;
        })
        .immediate();
      if (!job) return;
      this.currentJob = job.id;
      this.progressBase = 0;
      this.progressSpan = 90;
      try {
        let text = "";
        let qr: string | null = null;
        let verification: {
          status: EkasaStatus;
          amount?: number;
          merchant?: string;
        } = { status: "NotAttempted" };
        if (extname(job.path) === ".pdf") {
          const { getDocument } =
            await import("pdfjs-dist/legacy/build/pdf.mjs");
          const loading = getDocument({
            data: new Uint8Array(await readFile(job.path)),
            useSystemFonts: true,
          });
          const pdf = await loading.promise;
          try {
            if (pdf.numPages > 100) throw Error("PDF má viac než 100 strán.");
            for (let page = 1; page <= pdf.numPages; page++) {
              this.progressBase = ((page - 1) / pdf.numPages) * 90;
              this.progressSpan = 90 / pdf.numPages;
              const pdfPage = await pdf.getPage(page);
              const content = await pdfPage.getTextContent();
              let pageText = content.items
                .map((i) => ("str" in i ? i.str : ""))
                .join(" ");
              const needsOCR = pageText.trim().length < 20;
              if (needsOCR || !qr) {
                const viewport = pdfPage.getViewport({ scale: 1.5 });
                if (viewport.width * viewport.height > 12000000)
                  throw Error("PDF page exceeds pixel limit");
                const canvas = createCanvas(
                  Math.ceil(viewport.width),
                  Math.ceil(viewport.height),
                );
                await pdfPage.render({
                  canvas: null,
                  canvasContext: canvas.getContext(
                    "2d",
                  ) as unknown as CanvasRenderingContext2D,
                  viewport,
                }).promise;
                const png = canvas.toBuffer("image/png");
                const pixels = canvas
                  .getContext("2d")
                  .getImageData(0, 0, canvas.width, canvas.height).data;
                qr =
                  qr ?? jsQR(pixels, canvas.width, canvas.height)?.data ?? null;
                verification = await this.verify(qr);
                this.db
                  .prepare("UPDATE documents SET ekasa=? WHERE id=?")
                  .run(verification.status, job.document_id);
                if (needsOCR) pageText = await this.recognize(png);
              }
              text += "[Page " + page + "]\n" + pageText + "\n";
              this.db
                .prepare("UPDATE processing_jobs SET progress=? WHERE id=?")
                .run(Math.floor((page / pdf.numPages) * 90), job.id);
            }
          } finally {
            await loading.destroy();
          }
        } else {
          const canvas = await imageCanvas(await readFile(job.path));
          const pixels = canvas
            .getContext("2d")
            .getImageData(0, 0, canvas.width, canvas.height).data;
          qr = jsQR(pixels, canvas.width, canvas.height)?.data ?? null;
          verification = await this.verify(qr);
          this.db
            .prepare("UPDATE documents SET ekasa=? WHERE id=?")
            .run(verification.status, job.document_id);
          text = await this.recognize(job.path);
        }
        this.db
          .prepare(
            "INSERT INTO receipt_details(document_id,qr,verification,ocr) VALUES(?,?,?,?) ON CONFLICT(document_id) DO UPDATE SET qr=excluded.qr,verification=excluded.verification,ocr=excluded.ocr",
          )
          .run(job.document_id, qr, JSON.stringify(verification), text);
        this.onText?.(
          job.document_id,
          text,
          extname(job.path) === ".pdf" ? "pdf_or_ocr" : "ocr",
          verification,
        );
        this.db.transaction(() => {
          this.db
            .prepare(
              "UPDATE documents SET text=?,status='needs_review',error=NULL WHERE id=?",
            )
            .run(text, job.document_id);
          this.db
            .prepare(
              "UPDATE processing_jobs SET status='needs_review',progress=100 WHERE id=?",
            )
            .run(job.id);
        })();
      } catch (e) {
        this.db.transaction(() => {
          this.db
            .prepare("UPDATE documents SET status='failed',error=? WHERE id=?")
            .run(
              e instanceof Error ? e.message : "Spracovanie zlyhalo",
              job.document_id,
            );
          this.db
            .prepare("UPDATE processing_jobs SET status='failed' WHERE id=?")
            .run(job.id);
        })();
      }
    } finally {
      if (this.ocrWorker) {
        await this.ocrWorker.terminate();
        this.ocrWorker = undefined;
      }
      this.currentJob = null;
      this.busy = false;
    }
  }
}
export class LocalFolderSource implements DocumentSourceAdapter {
  private watcher?: FSWatcher;
  private timer?: ReturnType<typeof setInterval>;
  private scanning = false;
  constructor(
    readonly path: string,
    readonly documents: DocumentService,
    readonly onError: (e: unknown) => void,
  ) {}
  private async scan() {
    if (this.scanning) return;
    this.scanning = true;
    try {
      for (const entry of await readdir(this.path, { withFileTypes: true })) {
        if (entry.isFile() && /\.(pdf|png|jpe?g|webp)$/i.test(entry.name)) {
          const path = join(this.path, entry.name);
          const info = await stat(path);
          if (Date.now() - info.mtimeMs > 5000)
            await this.documents.importFile(path);
        }
      }
    } catch (e) {
      this.onError(e);
    } finally {
      this.scanning = false;
    }
  }
  async start() {
    this.watcher = watch(this.path, {
      depth: 0,
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 5000, pollInterval: 500 },
    });
    this.watcher.on("add", (p) => {
      void this.documents.importFile(p).catch(this.onError);
    });
    this.watcher.on("error", this.onError);
    await this.scan();
    this.timer = setInterval(() => void this.scan(), 60000);
  }
  async stop() {
    if (this.timer) clearInterval(this.timer);
    await this.watcher?.close();
  }
}
export async function relocateArchive(db: FinanceDatabase, root: string) {
  const rows = db.prepare("SELECT id,path,hash FROM documents").all() as {
    id: string;
    path: string;
    hash: string;
  }[];
  for (const row of rows) {
    const ext = extname(row.path).toLowerCase();
    if (
      !/^[a-f0-9]{64}$/.test(row.hash) ||
      ![".pdf", ".png", ".jpg", ".jpeg", ".webp"].includes(ext)
    )
      throw Error("Neplatný záznam archívu.");
    const destination = join(root, "Archive", row.hash + ext);
    const bytes = await readFile(destination);
    if (createHash("sha256").update(bytes).digest("hex") !== row.hash)
      throw Error("V zálohe chýba originál alebo má nesprávny obsah.");
    db.prepare("UPDATE documents SET path=? WHERE id=?").run(
      destination,
      row.id,
    );
  }
}
