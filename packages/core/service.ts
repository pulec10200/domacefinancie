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
  addAccount(input: unknown) {
    const v = accountInput.parse(input);
    const id = randomUUID();
    this.db.transaction(() => {
      this.db
        .prepare("INSERT INTO accounts VALUES(?,?,?,?,?)")
        .run(id, v.name, v.type, v.currency, v.opening);
      this.audit("account.created", id);
    })();
    return id;
  }
  addTransaction(input: unknown) {
    const v = transactionInput.parse(input);
    if (v.kind === "transfer" && (!v.targetId || v.targetId === v.accountId))
      throw Error("Vyberte iný cieľový účet.");
    if (v.kind !== "transfer" && v.targetId)
      throw Error("Cieľový účet patrí iba prevodu.");
    const id = randomUUID();
    const old = this.db
      .prepare("SELECT id FROM transactions WHERE request_id=?")
      .get(v.requestId) as { id: string } | undefined;
    if (old) return old.id;
    this.db
      .prepare("INSERT INTO transactions VALUES(?,?,?,?,?,?,?,?,?)")
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
      );
    return id;
  }
  addRule(input: unknown) {
    const v = ruleInput.parse(input);
    const id = randomUUID();
    this.db.transaction(() => {
      this.db
        .prepare("INSERT INTO obligation_rules VALUES(?,?,?,?,?,?)")
        .run(id, v.name, v.amount, v.start, v.end ?? null, v.interval);
      this.audit("rule.created", id);
    })();
    return id;
  }
  generate(until: string) {
    const rules = this.db.prepare("SELECT * FROM obligation_rules").all() as {
      id: string;
      name: string;
      amount: number;
      start: string;
      end: string | null;
      interval: number;
    }[];
    this.db.transaction(() => {
      for (const r of rules) {
        for (let n = 0; n < 2400; n++) {
          const due = occurrence(r.start, n * r.interval);
          if (due > until || (r.end && due > r.end)) break;
          this.db
            .prepare("INSERT OR IGNORE INTO payables VALUES(?,?,?,?,?)")
            .run(randomUUID(), r.id, r.name, due, r.amount);
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
          "SELECT amount-COALESCE((SELECT SUM(amount) FROM payment_allocations WHERE payable_id=payables.id),0) remaining FROM payables WHERE id=?",
        )
        .get(v.payableId) as { remaining: number } | undefined;
      if (!p || v.amount > p.remaining)
        throw Error("Platba presahuje nezaplatenú sumu.");
      const id = this.addTransaction({
        accountId: v.accountId,
        kind: "expense",
        amount: v.amount,
        date: v.date,
        description: "Úhrada povinnosti",
        category: "Povinnosti",
        requestId: v.requestId,
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
        });
      } else {
        id = randomUUID();
        this.db
          .prepare("INSERT INTO payables VALUES(?,NULL,?,?,?)")
          .run(id, v.name, v.date, v.amount);
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
  snapshot(today = new Date().toISOString().slice(0, 10)): Snapshot {
    const month = today.slice(0, 7);
    const next = occurrence(month + "-01", 1).slice(0, 7);
    this.generate(occurrence(next + "-01", 1));
    const accounts = this.db
      .prepare(
        `SELECT a.*,a.opening+COALESCE((SELECT SUM(CASE WHEN t.account_id=a.id THEN CASE WHEN kind='income' THEN amount ELSE -amount END ELSE amount END) FROM transactions t WHERE t.account_id=a.id OR t.target_id=a.id),0) balance FROM accounts a`,
      )
      .all() as Account[];
    const payables = this.db
      .prepare(
        "SELECT p.*,COALESCE((SELECT SUM(amount) FROM payment_allocations WHERE payable_id=p.id),0) paid FROM payables p ORDER BY due",
      )
      .all() as Payable[];
    const transactions = this.db
      .prepare("SELECT * FROM transactions ORDER BY date DESC,rowid DESC")
      .all() as Transaction[];
    return {
      accounts,
      transactions,
      payables,
      documents: this.db
        .prepare(
          "SELECT id,name,status,ekasa,error,text FROM documents ORDER BY rowid DESC",
        )
        .all() as DocumentRow[],
      monthly: [month, next].map((m) => ({
        month: m,
        income: transactions
          .filter((t) => t.kind === "income" && t.date.startsWith(m))
          .reduce((s, t) => s + t.amount, 0),
        expenses: transactions
          .filter((t) => t.kind === "expense" && t.date.startsWith(m))
          .reduce((s, t) => s + t.amount, 0),
        unpaid: payables
          .filter((p) => p.due.startsWith(m))
          .reduce((s, p) => s + p.amount - p.paid, 0),
      })),
    };
  }
}
