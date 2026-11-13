import { randomUUID } from "node:crypto";
import type { FinanceDatabase } from "../database";
import { date, parseMoney } from "../contracts";
import type { ExtractionField } from "../contracts/extraction";
export type Verification = {
  status: string;
  amount?: number;
  merchant?: string;
};
export function extractFields(text: string) {
  const normalized = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const fields: {
    field: string;
    value: unknown;
    method: string;
    page: number | null;
  }[] = [];
  const add = (field: string, value: unknown, index = 0) => {
    const pages = [...normalized.slice(0, index).matchAll(/\[Page (\d+)\]/g)];
    fields.push({
      field,
      value,
      method: "labelled_text",
      page: pages.length ? Number(pages.at(-1)![1]) : null,
    });
  };
  const types: [RegExp, string][] = [
    [/poistna zmluva|insurance policy/i, "insurance"],
    [/uverova zmluva|loan agreement/i, "loan"],
    [/najomna zmluva|rental agreement/i, "rental"],
    [/zmluva.*sluz|service agreement/i, "service"],
    [/faktura|invoice/i, "invoice"],
    [/pokladnicny doklad|receipt|\bUID\b/i, "receipt"],
    [/\bzmluva\b|\bcontract\b/i, "other_contract"],
  ];
  add(
    "documentType",
    types.find(([r]) => r.test(normalized))?.[1] ?? "unknown",
  );
  for (const m of normalized.matchAll(
    /(?:suma\s+na\s+uhradu|k\s+uhrade|celkom|total(?:\s+due)?|spolu\s+s\s+DPH)\s*[:=]?\s*(\d[\d \u00a0]*(?:[.,]\d{2}))(?![\d.,])(?:\s*(?:EUR|€))?/gi,
  )) {
    try {
      const value = parseMoney(m[1].replace(/[ \u00a0]/g, ""));
      if (
        value > 0 &&
        !fields.some((f) => f.field === "amount" && f.value === value)
      )
        add("amount", value, m.index);
    } catch {
      /* Invalid monetary strings remain manual review. */
    }
  }
  for (const m of normalized.matchAll(
    /(?:datum\s+splatnosti|splatnost|due\s+date|datum\s+vystavenia|datum\s+predaja|date)\s*[:=]?\s*(\d{4}-\d{2}-\d{2}|\d{1,2}\.\s*\d{1,2}\.\s*\d{4})/gi,
  )) {
    let value = m[1];
    if (value.includes(".")) {
      const [d, month, y] = value.split(".").map((v) => v.trim());
      value = `${y}-${month.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
    if (
      date.safeParse(value).success &&
      !fields.some((f) => f.field === "date" && f.value === value)
    )
      add("date", value, m.index);
  }
  if (fields.some((f) => f.field === "documentType" && f.value === "receipt")) {
    const items: {
      name: string;
      quantity: string | null;
      amountCents: number;
    }[] = [];
    for (const line of text.split(/\r?\n/)) {
      if (/celkom|total|spolu|dph|hotovost|platba|splatnost/i.test(line))
        continue;
      const m = line
        .trim()
        .match(
          /^(.{2,100}?)\s+(?:(\d+(?:[.,]\d+)?)\s*[xX×]\s*\d+[.,]\d{2}\s+)?(\d+[.,]\d{2})(?:\s*(?:EUR|€))?$/,
        );
      if (m) {
        try {
          items.push({
            name: m[1].trim(),
            quantity: m[2] ?? null,
            amountCents: parseMoney(m[3]),
          });
        } catch {
          /* uncertain line stays in raw OCR */
        }
      }
      if (items.length >= 500) break;
    }
    if (items.length) add("items", items);
  }
  return fields;
}
export class ExtractionService {
  constructor(readonly db: FinanceDatabase) {}
  propose(
    documentId: string,
    text: string,
    source: string,
    verification?: Verification,
  ) {
    const fields = extractFields(text);
    if (
      verification?.status === "Verified" &&
      Number.isSafeInteger(verification.amount) &&
      verification.amount! > 0
    )
      fields.unshift({
        field: "amount",
        value: verification.amount,
        method: "verified_service",
        page: null,
      });
    this.db.transaction(() => {
      for (const f of fields)
        this.db
          .prepare(
            "INSERT INTO extraction_results(id,document_id,field,value,source,method,page) VALUES(?,?,?,?,?,?,?)",
          )
          .run(
            randomUUID(),
            documentId,
            f.field,
            JSON.stringify(f.value),
            f.method === "verified_service" ? "ekasa" : source,
            f.method,
            f.page,
          );
    })();
  }
  addAI(
    documentId: string,
    provider: string,
    output: {
      amountCents: number | null;
      date: string | null;
      name: string | null;
      documentType: string;
      summary: string;
      items: unknown[];
      intervalMonths?: number | null;
    },
  ) {
    this.db.transaction(() => {
      for (const [field, value] of Object.entries({
        amount: output.amountCents,
        date: output.date,
        name: output.name,
        documentType: output.documentType,
        summary: output.summary,
        items: output.items,
        interval: output.intervalMonths ?? null,
      })) {
        if (value !== null)
          this.db
            .prepare(
              "INSERT INTO extraction_results(id,document_id,field,value,source,method) VALUES(?,?,?,?,?,?)",
            )
            .run(
              randomUUID(),
              documentId,
              field,
              JSON.stringify(value),
              provider,
              "ai",
            );
      }
    })();
  }
  confirm(documentId: string, values: Record<string, unknown>) {
    this.db.transaction(() => {
      for (const [field, value] of Object.entries(values)) {
        const entries = this.db
          .prepare(
            "SELECT id FROM extraction_results WHERE document_id=? AND field=?",
          )
          .all(documentId, field) as { id: string }[];
        if (entries.length)
          this.db
            .prepare(
              "UPDATE extraction_results SET confirmed_value=? WHERE document_id=? AND field=? AND method!='confirmation'",
            )
            .run(JSON.stringify(value), documentId, field);
        else
          this.db
            .prepare(
              "INSERT INTO extraction_results(id,document_id,field,value,source,method,confirmed_value) VALUES(?,?,?,?,'user','manual',?)",
            )
            .run(
              randomUUID(),
              documentId,
              field,
              JSON.stringify(value),
              JSON.stringify(value),
            );
        this.db
          .prepare(
            "INSERT INTO extraction_results(id,document_id,field,value,source,method,confirmed_value) VALUES(?,?,?,?,'user','confirmation',?)",
          )
          .run(
            randomUUID(),
            documentId,
            field,
            JSON.stringify(value),
            JSON.stringify(value),
          );
      }
    })();
  }
  list(): ExtractionField[] {
    return (
      this.db
        .prepare("SELECT * FROM extraction_results ORDER BY rowid")
        .all() as any[]
    ).map((v) => ({
      id: v.id,
      documentId: v.document_id,
      field: v.field,
      value: JSON.parse(v.value),
      source: v.source,
      method: v.method,
      confidence: v.confidence,
      page: v.page,
      confirmedValue:
        v.confirmed_value === null ? null : JSON.parse(v.confirmed_value),
    }));
  }
}
