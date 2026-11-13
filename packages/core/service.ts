import { z } from "zod";
import { localDate } from "../contracts/primitives";
import { randomUUID } from "node:crypto";
import type { FinanceDatabase } from "../database";
import {
  confirmationInput,
  accountInput,
  transactionInput,
  ruleInput,
  paymentInput,
  type Account,
  type Payable,
  type Transaction,
  type DocumentRow,
  type Snapshot,
} from "../contracts";
export function occurrence(start: string, offset: number): string {
  const [y, m, d] = start.split("-").map(Number);
  const month = new Date(Date.UTC(y, m - 1 + offset, 1));
  const last = new Date(
    Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0),
  ).getUTCDate();
  month.setUTCDate(Math.min(d, last));
  return month.toISOString().slice(0, 10);
}
export class FinanceService {
  constructor(readonly db: FinanceDatabase) {}
  private audit(action: string, id: string) {
    this.db
      .prepare("INSERT INTO audit_events(action,entity_id) VALUES(?,?)")
      .run(action, id);
  }
  private assertLedger() {
    const balances = this.db
      .prepare(
        "SELECT a.opening+COALESCE((SELECT SUM(CASE WHEN t.account_id=a.id THEN CASE WHEN kind='income' THEN amount ELSE -amount END ELSE amount END) FROM transactions t WHERE t.voided=0 AND (t.account_id=a.id OR t.target_id=a.id)),0) balance FROM accounts a",
      )
      .safeIntegers()
      .all() as { balance: bigint }[];
    let total = 0n;
    for (const { balance } of balances) {
      if (
        typeof balance !== "bigint" ||
        balance > BigInt(Number.MAX_SAFE_INTEGER) ||
        balance < BigInt(Number.MIN_SAFE_INTEGER)
      )
        throw Error("Zostatok presahuje bezpečný rozsah meny.");
      total += balance;
    }
    if (
      total > BigInt(Number.MAX_SAFE_INTEGER) ||
      total < BigInt(Number.MIN_SAFE_INTEGER)
    )
      throw Error("Celkový zostatok presahuje podporovaný rozsah.");
    const monthly = this.db
      .prepare(
        "SELECT SUM(amount) total FROM transactions WHERE voided=0 AND kind!='transfer' GROUP BY kind,substr(date,1,7)",
      )
      .safeIntegers()
      .all() as { total: bigint }[];
    for (const row of monthly)
      if (
        typeof row.total !== "bigint" ||
        row.total > BigInt(Number.MAX_SAFE_INTEGER)
      )
        throw Error("Mesačný súčet presahuje podporovaný rozsah.");
  }
  addAccount(input: unknown) {
    const v = accountInput.parse(input);
    const id = randomUUID();
    this.db.transaction(() => {
      this.db
        .prepare(
          "INSERT INTO accounts(id,name,type,currency,opening) VALUES(?,?,?,?,?)",
        )
        .run(id, v.name, v.type, v.currency, v.opening);
      this.assertLedger();
      this.audit("account.created", id);
    })();
    return id;
  }
  private assertActiveAccount(id: string) {
    const row = this.db
      .prepare("SELECT archived FROM accounts WHERE id=?")
      .get(id) as { archived: number } | undefined;
    if (!row || row.archived) throw Error("Vyberte aktívny finančný účet.");
  }
  addTransaction(input: unknown) {
    const v = transactionInput.parse(input);
    if (v.kind === "transfer" && (!v.targetId || v.targetId === v.accountId))
      throw Error("Vyberte iný cieľový účet.");
    if (v.kind !== "transfer" && v.targetId)
      throw Error("Cieľový účet patrí iba prevodu.");
    return this.db.transaction(() => {
      const id = randomUUID();
      const old = this.db
        .prepare("SELECT id FROM transactions WHERE request_id=?")
        .get(v.requestId) as { id: string } | undefined;
      if (old) return old.id;
      this.assertActiveAccount(v.accountId);
      if (v.targetId) this.assertActiveAccount(v.targetId);
      this.db
        .prepare(
          "INSERT INTO transactions(id,account_id,target_id,kind,amount,date,description,category,request_id,category_id,asset_id,contract_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
        )
        .run(
          id,
          v.accountId,
          v.targetId ?? null,
          v.kind,
          v.amount,
          v.date,
          v.description,
          v.category,
          v.requestId,
          v.categoryId ?? null,
          v.assetId ?? null,
          v.contractId ?? null,
        );
      this.assertLedger();
      this.audit("transaction.created", id);
      return id;
    })();
  }
  updateAccount(input: unknown) {
    const v = accountInput.extend({ id: z.string().uuid() }).parse(input);
    this.db.transaction(() => {
      const result = this.db
        .prepare("UPDATE accounts SET name=?,type=?,opening=? WHERE id=?")
        .run(v.name, v.type, v.opening, v.id);
      if (!result.changes) throw Error("Účet neexistuje.");
      this.assertLedger();
      this.audit("account.updated", v.id);
    })();
  }
  updateTransaction(input: unknown) {
    const v = transactionInput.extend({ id: z.string().uuid() }).parse(input);
    if (v.kind === "transfer" && (!v.targetId || v.targetId === v.accountId))
      throw Error("Vyberte odlišné účty prevodu.");
    if (v.kind !== "transfer" && v.targetId)
      throw Error("Cieľový účet patrí iba prevodu.");
    this.db.transaction(() => {
      if (
        this.db
          .prepare("SELECT id FROM payment_allocations WHERE transaction_id=?")
          .get(v.id)
      )
        throw Error(
          "Spárovanú úhradu nemožno upraviť ako samostatnú transakciu.",
        );
      const changed = this.db
        .prepare(
          "UPDATE transactions SET account_id=?,target_id=?,kind=?,amount=?,date=?,description=?,category=?,category_id=?,asset_id=?,contract_id=? WHERE id=? AND voided=0",
        )
        .run(
          v.accountId,
          v.targetId ?? null,
          v.kind,
          v.amount,
          v.date,
          v.description,
          v.category,
          v.categoryId ?? null,
          v.assetId ?? null,
          v.contractId ?? null,
          v.id,
        );
      if (!changed.changes)
        throw Error("Transakcia neexistuje alebo bola stornovaná.");
      this.assertLedger();
      this.audit("transaction.updated", v.id);
    })();
  }
  restoreTransaction(id: string) {
    this.db.transaction(() => {
      const result = this.db
        .prepare("UPDATE transactions SET voided=0 WHERE id=?")
        .run(id);
      if (!result.changes) throw Error("Transakcia neexistuje.");
      this.assertLedger();
      this.audit("transaction.restored", id);
    })();
  }
  addRule(input: unknown) {
    const v = ruleInput.parse(input);
    const id = randomUUID();
    this.db.transaction(() => {
      this.db
        .prepare(
          "INSERT INTO obligation_rules(id,name,amount,start,end,interval,asset_id,contract_id,direction) VALUES(?,?,?,?,?,?,?,?,?)",
        )
        .run(
          id,
          v.name,
          v.amount,
          v.start,
          v.end ?? null,
          v.interval,
          v.assetId ?? null,
          v.contractId ?? null,
          v.direction,
        );
      this.audit("rule.created", id);
    })();
    return id;
  }
  generate(until: string) {
    const rules = this.db
      .prepare("SELECT * FROM obligation_rules WHERE active=1")
      .all() as {
      id: string;
      name: string;
      amount: number;
      start: string;
      end: string | null;
      interval: number;
      asset_id: string | null;
      contract_id: string | null;
      direction: "income" | "expense";
    }[];
    this.db.transaction(() => {
      for (const r of rules) {
        for (let n = 0; n < 2400; n++) {
          const due = occurrence(r.start, n * r.interval);
          if (due > until || (r.end && due > r.end)) break;
          const change = this.db
            .prepare(
              "SELECT amount FROM obligation_changes WHERE rule_id=? AND effective<=? AND amount IS NOT NULL ORDER BY effective DESC LIMIT 1",
            )
            .get(r.id, due) as { amount: number } | undefined;
          const exception = this.db
            .prepare(
              "SELECT skip FROM obligation_changes WHERE rule_id=? AND effective=?",
            )
            .get(r.id, due) as { skip: number } | undefined;
          if (exception?.skip) {
            if (!r.interval) break;
            continue;
          }
          this.db
            .prepare(
              "INSERT OR IGNORE INTO payables(id,rule_id,name,due,amount,asset_id,contract_id,direction,period_due) VALUES(?,?,?,?,?,?,?,?,?)",
            )
            .run(
              randomUUID(),
              r.id,
              r.name,
              due,
              change?.amount ?? r.amount,
              r.asset_id,
              r.contract_id,
              r.direction,
              due,
            );
          if (!r.interval) break;
        }
      }
    })();
  }
  pay(input: unknown) {
    const v = paymentInput.parse(input);
    this.db.transaction(() => {
      if (
        this.db
          .prepare("SELECT id FROM transactions WHERE request_id=?")
          .get(v.requestId)
      )
        return;
      const p = this.db
        .prepare(
          "SELECT amount-COALESCE((SELECT SUM(amount) FROM payment_allocations WHERE payable_id=payables.id),0) remaining FROM payables WHERE id=? AND cancelled=0",
        )
        .get(v.payableId) as { remaining: number } | undefined;
      if (!p || v.amount > p.remaining)
        throw Error("Platba presahuje nezaplatenú sumu.");
      const related = this.db
        .prepare(
          "SELECT asset_id,contract_id,direction FROM payables WHERE id=?",
        )
        .get(v.payableId) as {
        asset_id: string | null;
        contract_id: string | null;
        direction: "income" | "expense";
      };
      const id = this.addTransaction({
        accountId: v.accountId,
        kind: related.direction,
        amount: v.amount,
        date: v.date,
        description: "Úhrada povinnosti",
        category: "Povinnosti",
        requestId: v.requestId,
        assetId: related.asset_id ?? undefined,
        contractId: related.contract_id ?? undefined,
      });
      this.db
        .prepare("INSERT INTO payment_allocations VALUES(?,?,?,?)")
        .run(randomUUID(), v.payableId, id, v.amount);
      this.audit("payable.paid", v.payableId);
    })();
  }
  confirmDocument(input: unknown) {
    const v = confirmationInput.parse(input);
    return this.db.transaction(() => {
      const prior = this.db
        .prepare(
          "SELECT entity_id FROM document_confirmations WHERE document_id=?",
        )
        .get(v.documentId) as { entity_id: string } | undefined;
      if (prior) return prior.entity_id;
      if (
        !this.db
          .prepare("SELECT id FROM documents WHERE id=?")
          .get(v.documentId)
      )
        throw Error("Dokument sa nenašiel.");
      let id: string;
      if (v.kind === "receipt") {
        if (!v.accountId) throw Error("Vyberte účet pre výdavok.");
        id = this.addTransaction({
          accountId: v.accountId,
          kind: "expense",
          amount: v.amount,
          date: v.date,
          description: v.name,
          category: "Doklady",
          requestId: v.documentId,
          assetId: v.assetId,
          contractId: v.contractId,
        });
      } else if (v.payableId) {
        const existing = this.db
          .prepare("SELECT * FROM payables WHERE id=? AND cancelled=0")
          .get(v.payableId) as Payable | undefined;
        if (
          !existing ||
          existing.document_id ||
          existing.direction === "income"
        )
          throw Error("Povinnosť neexistuje alebo už má faktúru.");
        const paid = (
          this.db
            .prepare(
              "SELECT COALESCE(SUM(amount),0) paid FROM payment_allocations WHERE payable_id=?",
            )
            .get(v.payableId) as { paid: number }
        ).paid;
        if (v.amount < paid)
          throw Error("Suma je nižšia než už zaplatená suma.");
        this.db
          .prepare(
            "UPDATE payables SET estimated_amount=COALESCE(estimated_amount,amount),amount=?,due=?,document_id=? WHERE id=?",
          )
          .run(v.amount, v.date, v.documentId, v.payableId);
        id = v.payableId;
      } else {
        id = randomUUID();
        this.db
          .prepare(
            "INSERT INTO payables(id,rule_id,name,due,amount) VALUES(?,NULL,?,?,?)",
          )
          .run(id, v.name, v.date, v.amount);
        this.db
          .prepare(
            "UPDATE payables SET document_id=?,asset_id=?,contract_id=? WHERE id=?",
          )
          .run(v.documentId, v.assetId ?? null, v.contractId ?? null, id);
      }
      this.db
        .prepare("INSERT INTO document_confirmations VALUES(?,?,?)")
        .run(v.documentId, v.kind, id);
      this.db
        .prepare("UPDATE documents SET status='confirmed' WHERE id=?")
        .run(v.documentId);
      this.db
        .prepare(
          "UPDATE processing_jobs SET status='completed' WHERE document_id=?",
        )
        .run(v.documentId);
      this.audit("document.confirmed", v.documentId);
      return id;
    })();
  }
  archiveAccount(id: string, archived = true) {
    this.db
      .prepare("UPDATE accounts SET archived=? WHERE id=?")
      .run(Number(archived), id);
  }
  listRules() {
    return this.db
      .prepare("SELECT * FROM obligation_rules ORDER BY start")
      .all();
  }
  cancelPayable(id: string) {
    const p = this.db
      .prepare(
        "SELECT COALESCE(SUM(amount),0) paid FROM payment_allocations WHERE payable_id=?",
      )
      .get(id) as { paid: number };
    if (p.paid) throw Error("Zaplatenú povinnosť nemožno zrušiť.");
    this.db.prepare("UPDATE payables SET cancelled=1 WHERE id=?").run(id);
    this.audit("payable.cancelled", id);
  }
  changeRule(input: {
    ruleId: string;
    effective: string;
    amount?: number;
    skip: boolean;
  }) {
    this.db.transaction(() => {
      this.db
        .prepare(
          "INSERT INTO obligation_changes VALUES(?,?,?,?,?) ON CONFLICT(rule_id,effective) DO UPDATE SET amount=excluded.amount,skip=excluded.skip",
        )
        .run(
          randomUUID(),
          input.ruleId,
          input.effective,
          input.amount ?? null,
          Number(input.skip),
        );
      const rows = this.db
        .prepare(
          "SELECT p.id,p.due,COALESCE((SELECT SUM(amount) FROM payment_allocations WHERE payable_id=p.id),0) paid FROM payables p WHERE rule_id=? AND due>=? AND document_id IS NULL",
        )
        .all(input.ruleId, input.effective) as {
        id: string;
        due: string;
        paid: number;
      }[];
      for (const p of rows)
        if (!p.paid) {
          if (input.skip && p.due === input.effective)
            this.db
              .prepare("UPDATE payables SET cancelled=1 WHERE id=?")
              .run(p.id);
          else if (input.amount)
            this.db
              .prepare("UPDATE payables SET amount=? WHERE id=?")
              .run(input.amount, p.id);
        }
      this.audit("rule.changed", input.ruleId);
    })();
  }
  stopRule(id: string, effective = localDate()) {
    this.db.transaction(() => {
      this.db
        .prepare("UPDATE obligation_rules SET active=0 WHERE id=?")
        .run(id);
      this.db
        .prepare(
          "UPDATE payables SET cancelled=1 WHERE rule_id=? AND due>=? AND (SELECT COALESCE(SUM(amount),0) FROM payment_allocations WHERE payable_id=payables.id)=0 AND document_id IS NULL",
        )
        .run(id, effective);
    })();
  }
  voidTransaction(id: string) {
    this.db.transaction(() => {
      if (
        this.db
          .prepare("SELECT id FROM payment_allocations WHERE transaction_id=?")
          .get(id)
      )
        throw Error(
          "Úhradu povinnosti nemožno stornovať ako samostatnú transakciu.",
        );
      const result = this.db
        .prepare("UPDATE transactions SET voided=1 WHERE id=?")
        .run(id);
      if (!result.changes) throw Error("Transakcia neexistuje.");
      this.assertLedger();
      this.audit("transaction.voided", id);
    })();
  }
  snapshot(today = localDate()): Snapshot {
    const month = today.slice(0, 7);
    const next = occurrence(month + "-01", 1).slice(0, 7);
    this.generate(occurrence(next + "-01", 1));
    const accounts = this.db
      .prepare(
        `SELECT a.*,a.opening+COALESCE((SELECT SUM(CASE WHEN t.account_id=a.id THEN CASE WHEN kind='income' THEN amount ELSE -amount END ELSE amount END) FROM transactions t WHERE t.voided=0 AND (t.account_id=a.id OR t.target_id=a.id)),0) balance FROM accounts a`,
      )
      .all() as Account[];
    const payables = this.db
      .prepare(
        "SELECT p.*,COALESCE((SELECT SUM(amount) FROM payment_allocations WHERE payable_id=p.id),0) paid FROM payables p ORDER BY due",
      )
      .all() as Payable[];
    const transactions = this.db
      .prepare(
        "SELECT * FROM transactions WHERE voided=0 ORDER BY date DESC,rowid DESC",
      )
      .all() as Transaction[];
    return {
      accounts,
      transactions,
      transactionHistory: this.db
        .prepare("SELECT * FROM transactions ORDER BY date DESC,rowid DESC")
        .all() as Transaction[],
      payables,
      documents: this.db
        .prepare(
          "SELECT id,name,status,ekasa,error,text FROM documents ORDER BY rowid DESC",
        )
        .all() as DocumentRow[],
      monthly: [month, next].map((m, index) => ({
        month: m,
        income: transactions
          .filter((t) => t.kind === "income" && t.date.startsWith(m))
          .reduce((s, t) => s + t.amount, 0),
        expenses: transactions
          .filter((t) => t.kind === "expense" && t.date.startsWith(m))
          .reduce((s, t) => s + t.amount, 0),
        expectedIncome: payables
          .filter(
            (p) =>
              !p.cancelled && p.direction === "income" && p.due.startsWith(m),
          )
          .reduce((sum, p) => sum + p.amount - p.paid, 0),
        mandatory: payables
          .filter(
            (p) =>
              !p.cancelled && p.direction !== "income" && p.due.startsWith(m),
          )
          .reduce((sum, p) => sum + p.amount, 0),
        overdue: payables
          .filter(
            (p) => !p.cancelled && p.direction !== "income" && p.due < today,
          )
          .reduce((sum, p) => sum + p.amount - p.paid, 0),
        forecast:
          accounts.reduce((sum, a) => sum + a.balance, 0) +
          payables
            .filter(
              (p) => !p.cancelled && p.due <= (index ? next : month) + "-31",
            )
            .reduce(
              (sum, p) =>
                sum + (p.direction === "income" ? 1 : -1) * (p.amount - p.paid),
              0,
            ),
        unpaid: payables
          .filter(
            (p) =>
              !p.cancelled && p.direction !== "income" && p.due.startsWith(m),
          )
          .reduce((s, p) => s + p.amount - p.paid, 0),
      })),
    };
  }
}
