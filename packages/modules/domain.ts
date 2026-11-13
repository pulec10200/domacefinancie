import { randomUUID } from "node:crypto";
import type { FinanceDatabase } from "../database";
import {
  assetInput,
  contractInput,
  categoryInput,
  budgetInput,
  type Asset,
  type Contract,
  type Category,
  type DomainSnapshot,
  type Rule,
} from "../contracts/domain";
import type { Snapshot } from "../contracts";
export class DomainService {
  constructor(
    readonly db: FinanceDatabase,
    readonly finance: () => Snapshot,
    readonly rules: () => unknown[],
  ) {}
  saveAsset(input: unknown) {
    const v = assetInput.parse(input);
    const id = v.id ?? randomUUID();
    this.db
      .prepare(
        "INSERT INTO assets(id,name,type,details,value) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,type=excluded.type,details=excluded.details,value=excluded.value",
      )
      .run(id, v.name, v.type, JSON.stringify(v.details), v.value);
    return id;
  }
  saveContract(input: unknown) {
    const v = contractInput.parse(input);
    const id = v.id ?? randomUUID();
    this.db
      .prepare(
        "INSERT INTO contracts(id,name,type,provider,asset_id,document_id,details) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,type=excluded.type,provider=excluded.provider,asset_id=excluded.asset_id,document_id=excluded.document_id,details=excluded.details",
      )
      .run(
        id,
        v.name,
        v.type,
        v.provider,
        v.assetId,
        v.documentId,
        JSON.stringify(v.details),
      );
    return id;
  }
  saveCategory(input: unknown) {
    const v = categoryInput.parse(input);
    const id = v.id ?? randomUUID();
    if (v.parentId) {
      const ancestors = this.db
        .prepare(
          "WITH RECURSIVE parents(id,parent_id) AS (SELECT id,parent_id FROM categories WHERE id=? UNION SELECT c.id,c.parent_id FROM categories c JOIN parents p ON c.id=p.parent_id) SELECT id FROM parents",
        )
        .all(v.parentId) as { id: string }[];
      if (v.parentId === id || ancestors.some((a) => a.id === id))
        throw Error("Kategória nesmie byť vlastným predkom.");
    }
    this.db
      .prepare(
        "INSERT INTO categories VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,parent_id=excluded.parent_id,kind=excluded.kind",
      )
      .run(id, v.name, v.parentId, v.kind);
    return id;
  }
  saveBudget(input: unknown) {
    const v = budgetInput.parse(input);
    this.db
      .prepare(
        "INSERT INTO budgets VALUES(?,?,?,?) ON CONFLICT(month,category) DO UPDATE SET amount=excluded.amount",
      )
      .run(randomUUID(), v.month, v.category, v.amount);
  }
  archive(kind: "asset" | "contract", id: string, archived = true) {
    const table = kind === "asset" ? "assets" : "contracts";
    this.db
      .prepare(`UPDATE ${table} SET archived=? WHERE id=?`)
      .run(Number(archived), id);
  }
  snapshot(): DomainSnapshot {
    const f = this.finance();
    const categories = (
      this.db.prepare("SELECT * FROM categories ORDER BY name").all() as {
        id: string;
        name: string;
        parent_id: string | null;
        kind: Category["kind"];
      }[]
    ).map((v) => ({
      id: v.id,
      name: v.name,
      parentId: v.parent_id,
      kind: v.kind,
    }));
    const contractAssets = new Map(
      (
        this.db.prepare("SELECT id,asset_id FROM contracts").all() as {
          id: string;
          asset_id: string | null;
        }[]
      ).map((c) => [c.id, c.asset_id]),
    );
    const assets = (
      this.db
        .prepare("SELECT * FROM assets ORDER BY archived,name")
        .all() as any[]
    ).map((v) => ({
      ...v,
      details: JSON.parse(v.details),
      income: f.transactions
        .filter(
          (t) =>
            (t.asset_id === v.id ||
              (!t.asset_id &&
                t.contract_id &&
                contractAssets.get(t.contract_id) === v.id)) &&
            t.kind === "income",
        )
        .reduce((s, t) => s + t.amount, 0),
      expenses: f.transactions
        .filter(
          (t) =>
            (t.asset_id === v.id ||
              (!t.asset_id &&
                t.contract_id &&
                contractAssets.get(t.contract_id) === v.id)) &&
            t.kind === "expense",
        )
        .reduce((s, t) => s + t.amount, 0),
    })) as Asset[];
    const contracts = (
      this.db
        .prepare("SELECT * FROM contracts ORDER BY archived,name")
        .all() as any[]
    ).map((v) => ({
      ...v,
      assetId: v.asset_id,
      documentId: v.document_id,
      details: JSON.parse(v.details),
    })) as Contract[];
    const budgets = (
      this.db
        .prepare("SELECT * FROM budgets ORDER BY month DESC,category")
        .all() as any[]
    ).map((v) => {
      const included = new Set(
        categories.filter((c) => c.name === v.category).map((c) => c.id),
      );
      let size = -1;
      while (size !== included.size) {
        size = included.size;
        for (const c of categories)
          if (c.parentId && included.has(c.parentId)) included.add(c.id);
      }
      const names = new Set([
        v.category,
        ...categories.filter((c) => included.has(c.id)).map((c) => c.name),
      ]);
      const actual = f.transactions
        .filter(
          (t) =>
            t.kind === "expense" &&
            t.date.startsWith(v.month) &&
            (t.category_id
              ? included.has(t.category_id)
              : names.has(t.category)),
        )
        .reduce((s, t) => s + t.amount, 0);
      return { ...v, actual, remaining: v.amount - actual };
    });
    return {
      assets,
      contracts,
      categories,
      budgets,
      rules: this.rules() as Rule[],
    };
  }
}
