import { it, expect } from "vitest";
import {
  extractFields,
  ExtractionService,
} from "../packages/modules/extraction";
import { openDatabase } from "../packages/database";
import { randomUUID } from "node:crypto";
it("extracts labelled Slovak totals and due dates without guessing missing values", () => {
  const fields = extractFields(
    "[Page 2]\nFaktúra\nSuma na úhradu: 1 234,56 EUR\nDátum splatnosti: 1. 12. 2026",
  );
  expect(fields).toContainEqual({
    field: "amount",
    value: 123456,
    method: "labelled_text",
    page: 2,
  });
  expect(fields.find((f) => f.field === "date")?.value).toBe("2026-12-01");
  expect(
    extractFields("Zmluva bez sumy a dátumu").filter((f) =>
      ["amount", "date"].includes(f.field),
    ),
  ).toHaveLength(0);
});
it("keeps conflicting totals and rejects impossible dates", () => {
  const fields = extractFields(
    "TOTAL 12.34 EUR\nCelkom 20,00 EUR\nSplatnosť: 31.02.2026",
  );
  expect(fields.filter((f) => f.field === "amount")).toHaveLength(2);
  expect(fields.find((f) => f.field === "date")).toBeUndefined();
});
it("retains original suggestions alongside user corrections and distinct sources", () => {
  const db = openDatabase(":memory:");
  try {
    const id = randomUUID();
    db.prepare(
      "INSERT INTO documents(id,name,path,hash,status) VALUES(?,?,?,?,?)",
    ).run(id, "test", "path", "hash", "needs_review");
    const service = new ExtractionService(db);
    service.propose(id, "TOTAL 12.34 EUR", "ocr", {
      status: "Verified",
      amount: 1400,
    });
    expect(
      service
        .list()
        .filter((f) => f.field === "amount")
        .map((f) => f.source),
    ).toEqual(["ekasa", "ocr"]);
    service.confirm(id, { amount: 1400 });
    expect(
      service
        .list()
        .filter((f) => f.field === "amount" && f.method !== "confirmation")
        .map((f) => f.value),
    ).toEqual([1400, 1234]);
    expect(
      service
        .list()
        .some((f) => f.method === "confirmation" && f.value === 1400),
    ).toBe(true);
    expect(
      service
        .list()
        .filter((f) => f.field === "amount")
        .every((f) => f.confirmedValue === 1400),
    ).toBe(true);
  } finally {
    db.close();
  }
});
