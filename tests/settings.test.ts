import { it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { openDatabase, exportDatabase } from "../packages/database";
import { FinanceService } from "../packages/core/service";
import { SettingsService } from "../packages/modules/settings";
it("persists reminder settings and deduplicates delivery across scheduler ticks", () => {
  const db = openDatabase(":memory:");
  try {
    const finance = new FinanceService(db),
      settings = new SettingsService(db);
    finance.addRule({
      name: "Due",
      amount: 1000,
      start: "2026-11-20",
      interval: 0,
    });
    const p = finance.snapshot("2026-11-13").payables[0];
    expect(settings.shouldNotify(p.due, 0, p.amount, false, "2026-11-13")).toBe(
      true,
    );
    expect(settings.claimNotification(p.id, "2026-11-13", randomUUID())).toBe(
      true,
    );
    expect(settings.claimNotification(p.id, "2026-11-13", randomUUID())).toBe(
      false,
    );
    settings.save({
      reminderDays: [1, 0],
      background: true,
      startAtLogin: false,
    });
    expect(new SettingsService(db).preferences().background).toBe(true);
    expect(settings.shouldNotify(p.due, 0, p.amount, false, "2026-11-13")).toBe(
      false,
    );
    expect(settings.shouldNotify(p.due, 0, p.amount, false, "2026-11-21")).toBe(
      true,
    );
    expect(
      settings.shouldNotify(p.due, 1000, p.amount, false, "2026-11-21"),
    ).toBe(false);
    expect(settings.shouldNotify(p.due, 0, p.amount, true, "2026-11-21")).toBe(
      false,
    );
  } finally {
    db.close();
  }
});
it("exports financial data and configurations without encrypted API key material", () => {
  const db = openDatabase(":memory:");
  try {
    new FinanceService(db).addAccount({
      name: "Savings",
      type: "savings",
      opening: 12345,
    });
    db.prepare(
      "INSERT INTO ai_configurations(id,configuration,secret) VALUES(?,?,?)",
    ).run(
      randomUUID(),
      JSON.stringify({ name: "Provider" }),
      Buffer.from("ciphertext"),
    );
    const json = JSON.stringify(exportDatabase(db));
    expect(json).toContain("Savings");
    expect(json).toContain("12345");
    expect(json).not.toContain("ciphertext");
    expect(json).not.toContain('"secret"');
  } finally {
    db.close();
  }
});
it("projects expected income without treating it as a paid account credit", () => {
  const db = openDatabase(":memory:");
  try {
    const f = new FinanceService(db);
    const accountId = f.addAccount({
      name: "Cash",
      type: "cash",
      opening: 1000,
    });
    f.addRule({
      name: "Salary",
      amount: 20000,
      start: "2026-11-30",
      interval: 1,
      direction: "income",
    });
    f.addRule({
      name: "Rent",
      amount: 10000,
      start: "2026-11-25",
      interval: 1,
    });
    const s = f.snapshot("2026-11-13");
    expect(s.monthly[0].expectedIncome).toBe(20000);
    expect(s.monthly[0].unpaid).toBe(10000);
    expect(s.monthly[0].forecast).toBe(11000);
    expect(s.accounts[0].balance).toBe(1000);
    const p = s.payables.find((p) => p.name === "Salary")!;
    f.pay({
      payableId: p.id,
      accountId,
      amount: 20000,
      date: "2026-11-30",
      requestId: randomUUID(),
    });
    const paid = f.snapshot("2026-11-30");
    expect(paid.accounts[0].balance).toBe(21000);
    expect(paid.monthly[0].expectedIncome).toBe(0);
    expect(paid.monthly[0].forecast).toBe(11000);
  } finally {
    db.close();
  }
});
