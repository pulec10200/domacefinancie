import { it, expect, beforeEach, afterEach } from "vitest";
import { randomUUID } from "node:crypto";
import { openDatabase, type FinanceDatabase } from "../packages/database";
import { FinanceService } from "../packages/core/service";
import { DomainService } from "../packages/modules/domain";
let db: FinanceDatabase;
let finance: FinanceService;
let domain: DomainService;
beforeEach(() => {
  db = openDatabase(":memory:");
  finance = new FinanceService(db);
  domain = new DomainService(
    db,
    () => finance.snapshot("2026-11-13"),
    () => finance.listRules(),
  );
});
afterEach(() => db.close());
it("keeps assets, contracts and transactions linked without merging entities", () => {
  const assetId = domain.saveAsset({
    name: "Flat",
    type: "property",
    value: 10000000,
    details: { address: "Synthetic address" },
  });
  const contractId = domain.saveContract({
    name: "Insurance",
    type: "insurance",
    provider: "Test",
    assetId,
    details: { start: "2026-01-01", end: "2026-12-31", noticeDays: 42 },
  });
  const accountId = finance.addAccount({
    name: "Cash",
    type: "cash",
    opening: 10000,
  });
  finance.addTransaction({
    accountId,
    kind: "expense",
    amount: 1234,
    date: "2026-11-13",
    description: "Premium",
    assetId,
    contractId,
    requestId: randomUUID(),
  });
  const s = domain.snapshot();
  expect(s.assets[0].expenses).toBe(1234);
  expect(s.contracts[0].assetId).toBe(assetId);
  expect(s.contracts[0].details.anniversary).toBeNull();
  expect(s.contracts[0].details.noticeDays).toBe(42);
});
it("compares monthly category budgets against actual expenses only", () => {
  const accountId = finance.addAccount({
    name: "Cash",
    type: "cash",
    opening: 10000,
  });
  domain.saveBudget({ month: "2026-11", category: "Food", amount: 5000 });
  for (const [kind, amount, date] of [
    ["expense", 1200, "2026-11-13"],
    ["income", 500, "2026-11-13"],
    ["expense", 200, "2026-12-01"],
  ] as const)
    finance.addTransaction({
      accountId,
      kind,
      amount,
      date,
      category: "Food",
      description: "Test",
      requestId: randomUUID(),
    });
  expect(domain.snapshot().budgets[0]).toMatchObject({
    actual: 1200,
    remaining: 3800,
  });
  domain.saveBudget({ month: "2026-11", category: "Food", amount: 6000 });
  expect(domain.snapshot().budgets).toHaveLength(1);
});
it("rejects category cycles and contracts with impossible periods", () => {
  const parent = domain.saveCategory({ name: "Home", kind: "expense" });
  const child = domain.saveCategory({
    name: "Energy",
    parentId: parent,
    kind: "expense",
  });
  expect(() =>
    domain.saveCategory({
      id: parent,
      name: "Home",
      parentId: child,
      kind: "expense",
    }),
  ).toThrow();
  expect(() =>
    domain.saveContract({
      name: "Bad",
      type: "insurance",
      provider: "Test",
      details: { start: "2027-01-01", end: "2026-01-01" },
    }),
  ).toThrow();
});
it("changes future amounts and skips one occurrence without changing paid history", () => {
  const accountId = finance.addAccount({
    name: "Cash",
    type: "cash",
    opening: 10000,
  });
  const ruleId = finance.addRule({
    name: "Monthly",
    amount: 1000,
    start: "2026-10-01",
    interval: 1,
  });
  finance.snapshot("2026-11-13");
  const first = finance.snapshot("2026-11-13").payables[0];
  finance.pay({
    payableId: first.id,
    accountId,
    amount: 1000,
    date: "2026-10-01",
    requestId: randomUUID(),
  });
  finance.changeRule({
    ruleId,
    effective: "2026-11-01",
    amount: 1500,
    skip: false,
  });
  finance.changeRule({ ruleId, effective: "2026-12-01", skip: true });
  const s = finance.snapshot("2026-11-13");
  expect(s.payables.find((p) => p.due === "2026-10-01")?.amount).toBe(1000);
  expect(s.payables.find((p) => p.due === "2026-11-01")?.amount).toBe(1500);
  expect(s.payables.find((p) => p.due === "2026-12-01")?.cancelled).toBe(1);
  expect(s.monthly[1].unpaid).toBe(0);
});
it("attributes payment allocations to the asset attached to the rule", () => {
  const assetId = domain.saveAsset({
    name: "Car",
    type: "vehicle",
    details: {},
  });
  const accountId = finance.addAccount({
    name: "Cash",
    type: "cash",
    opening: 10000,
  });
  finance.addRule({
    name: "Insurance",
    amount: 2500,
    start: "2026-11-01",
    interval: 12,
    assetId,
  });
  const payable = finance.snapshot("2026-11-13").payables[0];
  finance.pay({
    payableId: payable.id,
    accountId,
    amount: 2500,
    date: "2026-11-13",
    requestId: randomUUID(),
  });
  expect(domain.snapshot().assets[0].expenses).toBe(2500);
});
it("rolls back money operations that exceed integer precision", () => {
  const accountId = finance.addAccount({
    name: "Cash",
    type: "cash",
    opening: Number.MAX_SAFE_INTEGER,
  });
  expect(() =>
    finance.addTransaction({
      accountId,
      kind: "income",
      amount: 1,
      date: "2026-11-13",
      description: "Overflow",
      requestId: randomUUID(),
    }),
  ).toThrow();
  expect(finance.snapshot().transactions).toHaveLength(0);
});
it("rolls descendant category expenses into a parent budget and preserves renamed links", () => {
  const parent = domain.saveCategory({ name: "Home", kind: "expense" });
  const child = domain.saveCategory({
    name: "Energy",
    parentId: parent,
    kind: "expense",
  });
  const accountId = finance.addAccount({
    name: "Cash",
    type: "cash",
    opening: 10000,
  });
  finance.addTransaction({
    accountId,
    kind: "expense",
    amount: 1000,
    date: "2026-11-13",
    category: "Energy",
    categoryId: child,
    description: "Electricity",
    requestId: randomUUID(),
  });
  domain.saveCategory({
    id: child,
    name: "Utilities",
    parentId: parent,
    kind: "expense",
  });
  domain.saveBudget({ month: "2026-11", category: "Home", amount: 5000 });
  expect(domain.snapshot().budgets[0].actual).toBe(1000);
});
it("reversibly archives accounts without losing historical balances", () => {
  const accountId = finance.addAccount({
    name: "Cash",
    type: "cash",
    opening: 10000,
  });
  finance.archiveAccount(accountId);
  expect(() =>
    finance.addTransaction({
      accountId,
      kind: "expense",
      amount: 100,
      date: "2026-11-13",
      description: "Test",
      requestId: randomUUID(),
    }),
  ).toThrow();
  expect(finance.snapshot().accounts[0].balance).toBe(10000);
  finance.archiveAccount(accountId, false);
  expect(finance.snapshot().accounts[0].archived).toBe(0);
});
