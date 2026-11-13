import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase, type FinanceDatabase } from "../packages/database";
import { FinanceService, occurrence } from "../packages/core/service";
import { parseMoney } from "../packages/contracts";
let db: FinanceDatabase;
let service: FinanceService;
let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "finance-test-"));
  db = openDatabase(join(dir, "test.db"));
  service = new FinanceService(db);
});
afterEach(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});
const account = (opening = 0) =>
  service.addAccount({ name: "Test account", type: "current", opening });
const transaction = (id: string, amount: number, kind = "expense") => ({
  accountId: id,
  amount,
  kind,
  date: "2026-11-13",
  description: "Test",
  requestId: randomUUID(),
});
describe("financial core", () => {
  it("uses integer cents and rejects malformed amounts", () => {
    expect(parseMoney("123,45")).toBe(12345);
    expect(parseMoney("-0.01")).toBe(-1);
    expect(() => parseMoney("1.234")).toThrow();
    expect(() => parseMoney("1e3")).toThrow();
  });
  it("creates accounts, income and expenses", () => {
    const id = account(10000);
    service.addTransaction(transaction(id, 1500, "income"));
    service.addTransaction(transaction(id, 2500));
    expect(service.snapshot().accounts[0].balance).toBe(9000);
  });
  it("transfers once without changing household wealth", () => {
    const from = account(10000);
    const to = account();
    const input = { ...transaction(from, 3000, "transfer"), targetId: to };
    service.addTransaction(input);
    service.addTransaction(input);
    const s = service.snapshot();
    expect(s.transactions).toHaveLength(1);
    expect(s.accounts.map((a) => a.balance)).toEqual([7000, 3000]);
  });
  it("rejects same-account transfers and nonexistent accounts", () => {
    const id = account();
    expect(() =>
      service.addTransaction({
        ...transaction(id, 100, "transfer"),
        targetId: id,
      }),
    ).toThrow();
    expect(() =>
      service.addTransaction(transaction(randomUUID(), 100)),
    ).toThrow();
  });
  it("clamps month-end from original anchor and handles leap years", () => {
    expect(occurrence("2024-01-31", 1)).toBe("2024-02-29");
    expect(occurrence("2024-01-31", 2)).toBe("2024-03-31");
    expect(occurrence("2024-02-29", 12)).toBe("2025-02-28");
  });
  it("places annual obligations only in their due month", () => {
    service.addRule({
      name: "Insurance",
      amount: 120000,
      start: "2026-12-20",
      interval: 12,
    });
    const s = service.snapshot("2026-11-13");
    expect(s.monthly[0].unpaid).toBe(0);
    expect(s.monthly[1].unpaid).toBe(120000);
    service.snapshot("2026-11-13");
    expect(service.snapshot("2026-11-13").payables).toHaveLength(1);
  });
  it("allocates partial payments atomically and rejects overpayment", () => {
    const id = account(10000);
    service.addRule({
      name: "Invoice",
      amount: 5000,
      start: "2026-11-14",
      interval: 0,
    });
    const p = service.snapshot("2026-11-13").payables[0];
    const payment = {
      payableId: p.id,
      accountId: id,
      amount: 2000,
      date: "2026-11-13",
      requestId: randomUUID(),
    };
    service.pay(payment);
    service.pay(payment);
    expect(service.snapshot("2026-11-13").payables[0].paid).toBe(2000);
    expect(() =>
      service.pay({ ...payment, amount: 4000, requestId: randomUUID() }),
    ).toThrow();
    expect(service.snapshot().transactions).toHaveLength(1);
  });
  it("rejects impossible dates and noninteger cents", () => {
    const id = account();
    expect(() =>
      service.addTransaction({ ...transaction(id, 100), date: "2026-02-30" }),
    ).toThrow();
    expect(() => service.addTransaction(transaction(id, 1.5))).toThrow();
  });
  it("reopens persisted data and applies migration only once", () => {
    account(1234);
    db.close();
    db = openDatabase(join(dir, "test.db"));
    service = new FinanceService(db);
    expect(service.snapshot().accounts[0].balance).toBe(1234);
    expect(db.prepare("SELECT * FROM schema_migrations").all()).toHaveLength(2);
    expect(db.pragma("integrity_check", { simple: true })).toBe("ok");
  });
  it("creates a restorable SQLite backup", async () => {
    account(7654);
    await db.backup(join(dir, "backup.db"));
    const restored = openDatabase(join(dir, "backup.db"));
    expect(new FinanceService(restored).snapshot().accounts[0].balance).toBe(
      7654,
    );
    restored.close();
  });
});
it("upgrades a version-1 database without losing accounts", () => {
  const id = account(4321);
  db.exec("DROP TABLE document_confirmations");
  db.prepare("DELETE FROM schema_migrations WHERE version=2").run();
  db.close();
  db = openDatabase(join(dir, "test.db"));
  service = new FinanceService(db);
  expect(service.snapshot().accounts[0].id).toBe(id);
  expect(service.snapshot().accounts[0].balance).toBe(4321);
  expect(
    db.prepare("SELECT version FROM schema_migrations ORDER BY version").all(),
  ).toEqual([{ version: 1 }, { version: 2 }]);
});
