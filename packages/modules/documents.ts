import { randomUUID, createHash } from "node:crypto";
import { mkdir, readFile, copyFile, stat, readdir } from "node:fs/promises";
import { constants } from "node:fs";
import { join, extname, basename } from "node:path";
import type { FinanceDatabase } from "../database";
import sharp from "sharp";
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
  verify(qr: string): Promise<{ status: EkasaStatus }>;
}
export class ManualEkasaProvider implements EkasaProvider {
  async verify(): Promise<{ status: EkasaStatus }> {
    return { status: "RequiresManualVerification" };
  }
}
export interface DocumentSourceAdapter {
  start(): Promise<void>;
  stop(): Promise<void>;
}
export class DocumentService {
  busy = false;
  constructor(
    readonly db: FinanceDatabase,
    readonly root: string,
    readonly languages: string,
    readonly ekasa: EkasaProvider = new ManualEkasaProvider(),
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
      const meta = await sharp(bytes, {
        limitInputPixels: 40000000,
      }).metadata();
      if (!["png", "jpeg", "webp"].includes(meta.format ?? ""))
        throw Error("Neplatný obrázok.");
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
    const worker = await createWorker(["slk", "eng"], 1, {
      langPath: this.languages,
      cacheMethod: "none",
      gzip: true,
    });
    try {
      return (await worker.recognize(input)).data.text;
    } finally {
      await worker.terminate();
    }
  }
  async processNext() {
    if (this.busy) return;
    this.busy = true;
    try {
      const job = this.db
        .prepare(
          "SELECT j.id,j.document_id,d.path FROM processing_jobs j JOIN documents d ON d.id=j.document_id WHERE j.status='pending' ORDER BY j.rowid LIMIT 1",
        )
        .get() as { id: string; document_id: string; path: string } | undefined;
      if (!job) return;
      this.db
        .prepare(
          "UPDATE processing_jobs SET status='running',attempts=attempts+1 WHERE id=?",
        )
        .run(job.id);
      try {
        let text = "";
        let qr: string | null = null;
        if (extname(job.path) === ".pdf") {
          const { getDocument } =
            await import("pdfjs-dist/legacy/build/pdf.mjs");
          const loading = getDocument({
            data: new Uint8Array(await readFile(job.path)),
            useSystemFonts: false,
          });
          const pdf = await loading.promise;
          try {
            if (pdf.numPages > 100) throw Error("PDF má viac než 100 strán.");
            for (let page = 1; page <= pdf.numPages; page++) {
              const pdfPage = await pdf.getPage(page);
              const content = await pdfPage.getTextContent();
              let pageText = content.items
                .map((i) => ("str" in i ? i.str : ""))
                .join(" ");
              if (pageText.trim().length < 20) {
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
                pageText = await this.recognize(canvas.toBuffer("image/png"));
              }
              text += "[Page " + page + "]\n" + pageText + "\n";
            }
          } finally {
            await loading.destroy();
          }
        } else {
          const image = await sharp(job.path, { limitInputPixels: 40000000 })
            .rotate()
            .ensureAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });
          qr =
            jsQR(
              new Uint8ClampedArray(image.data),
              image.info.width,
              image.info.height,
            )?.data ?? null;
          const verification = qr
            ? await this.ekasa.verify(qr)
            : { status: "NotAttempted" };
          this.db
            .prepare("UPDATE documents SET ekasa=? WHERE id=?")
            .run(verification.status, job.document_id);
          text = await this.recognize(job.path);
        }
        this.db.transaction(() => {
          this.db
            .prepare(
              "UPDATE documents SET text=?,status='needs_review',error=NULL WHERE id=?",
            )
            .run(text, job.document_id);
          this.db
            .prepare(
              "UPDATE processing_jobs SET status='needs_review' WHERE id=?",
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
