import { fork, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
export class DocumentProcessor {
  private child?: ChildProcess;
  private stopped = false;
  private diagnostic = "";
  private busy = false;
  private pending = new Map<
    string,
    {
      resolve: (v: any) => void;
      reject: (e: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  constructor(
    readonly entry: string,
    readonly directory: string,
    readonly languages: string,
    readonly onInterrupted: (message: string) => void,
  ) {}
  private fail(message: string) {
    for (const p of this.pending.values()) {
      clearTimeout(p.timer);
      p.reject(Error(message));
    }
    this.pending.clear();
    this.onInterrupted(message);
  }
  private spawn() {
    if (this.stopped) throw Error("Spracovanie sa ukončuje.");
    if (this.child) return this.child;
    const child = fork(this.entry, [], {
      execPath: process.execPath,
      execArgv: ["--max-old-space-size=512"],
      env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
      stdio: ["ignore", "ignore", "pipe", "ipc"],
      serialization: "json",
    });
    this.child = child;
    this.diagnostic = "";
    child.stderr?.on("data", (chunk: Buffer) => {
      this.diagnostic = (this.diagnostic + chunk.toString()).slice(0, 2500);
    });
    child.stdout?.on("data", () => {});
    child.on(
      "message",
      (message: { id: string; result?: unknown; error?: string }) => {
        const p = this.pending.get(message.id);
        if (!p) return;
        clearTimeout(p.timer);
        this.pending.delete(message.id);
        if (message.error) p.reject(Error(message.error));
        else p.resolve(message.result);
      },
    );
    child.on("error", () => {
      if (this.child !== child) return;
      this.child = undefined;
      this.fail("Proces dokumentov sa nepodarilo spustiť.");
    });
    child.on("exit", () => {
      if (this.child !== child) return;
      this.child = undefined;
      if (!this.stopped)
        this.fail(
          "Proces spracovania dokumentu sa prerušil. Originál zostal zachovaný; spracovanie môžete zopakovať. " +
            this.diagnostic,
        );
    });
    return child;
  }
  private request(
    type: "process" | "preview",
    payload: Record<string, unknown> = {},
    timeout = 600000,
  ): Promise<any> {
    const child = this.spawn();
    const id = randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.child === child) {
          this.child = undefined;
          child.kill("SIGKILL");
        }
        this.fail(
          "Spracovanie prekročilo časový limit. Originál zostal zachovaný.",
        );
      }, timeout);
      this.pending.set(id, { resolve, reject, timer });
      child.send({
        id,
        type,
        directory: this.directory,
        languages: this.languages,
        ...payload,
      });
    });
  }
  schedule() {
    if (this.busy || this.stopped) return;
    this.busy = true;
    void Promise.resolve()
      .then(() => this.request("process"))
      .catch(() => {})
      .finally(() => {
        this.busy = false;
      });
  }
  preview(
    documentId: string,
    page: number,
  ): Promise<{ image: string; pages: number }> {
    return this.request("preview", { documentId, page }, 90000);
  }
  cancel() {
    const child = this.child;
    this.child = undefined;
    child?.kill();
    this.fail("Spracovanie prerušil používateľ. Originál zostal zachovaný.");
  }
  stop() {
    this.stopped = true;
    this.child?.kill("SIGKILL");
    this.child = undefined;
    for (const p of this.pending.values()) {
      clearTimeout(p.timer);
      p.reject(Error("Aplikácia sa ukončuje."));
    }
    this.pending.clear();
  }
}
