import { join } from "node:path";
import { z } from "zod";
import { openDatabase } from "../../../../packages/database";
import { DocumentService } from "../../../../packages/modules/documents";
import { ExtractionService } from "../../../../packages/modules/extraction";
const channel = {
  on: (_event: string, callback: (event: { data: unknown }) => void) =>
    process.on("message", (data) => callback({ data })),
  postMessage: (data: unknown) => {
    if (process.send) process.send(data);
  },
};
const input = z.object({
  id: z.string().uuid(),
  type: z.enum(["process", "preview"]),
  directory: z.string().min(1),
  languages: z.string().min(1),
  documentId: z.string().uuid().optional(),
  page: z.number().int().min(1).max(100).optional(),
});
let service: DocumentService | undefined;
let queue = Promise.resolve();
channel.on("message", (event) => {
  queue = queue
    .then(async () => {
      const v = input.parse(event.data);
      try {
        if (!service) {
          const db = openDatabase(join(v.directory, "finance.db"));
          const extraction = new ExtractionService(db);
          service = new DocumentService(
            db,
            join(v.directory, "documents"),
            v.languages,
            undefined,
            (id, text, source, verification) =>
              extraction.propose(id, text, source, verification),
          );
          await service.initialize();
        }
        let result: unknown = null;
        if (v.type === "process") await service.processNext();
        else result = await service.preview(v.documentId!, v.page!);
        channel.postMessage({ id: v.id, result });
      } catch (error) {
        channel.postMessage({
          id: v.id,
          error:
            error instanceof Error ? error.message : "Spracovanie zlyhalo.",
        });
      }
    })
    .catch(() => {
      process.exitCode = 1;
    });
});
