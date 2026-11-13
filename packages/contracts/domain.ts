import { ruleInput, type RuleInput } from "./index";
import { z } from "zod";
import { money, date, id } from "./primitives";
const label = z.string().trim().min(1).max(200);
export const assetInput = z.object({
  id: id.optional(),
  name: label,
  type: z.enum(["property", "vehicle", "financial", "other"]),
  value: money.nonnegative().nullable().default(null),
  details: z.object({
    address: z.string().max(1000).default(""),
    ownership: z.string().max(1000).default(""),
    identifier: z.string().max(200).default(""),
    notes: z.string().max(5000).default(""),
  }),
});
export const contractInput = z
  .object({
    id: id.optional(),
    name: label,
    type: z.enum(["insurance", "loan", "rental", "service", "other"]),
    provider: z.string().max(200),
    assetId: id.nullable().default(null),
    documentId: id.nullable().default(null),
    details: z.object({
      start: date.nullable().default(null),
      end: date.nullable().default(null),
      anniversary: date.nullable().default(null),
      premiumDue: date.nullable().default(null),
      noticeDays: z.number().int().min(0).max(3650).nullable().default(null),
      insuredAmount: money.nonnegative().nullable().default(null),
      notes: z.string().max(5000).default(""),
    }),
  })
  .refine(
    (v) =>
      !v.details.start || !v.details.end || v.details.end >= v.details.start,
    "Koniec predchádza začiatku zmluvy.",
  );
export const categoryInput = z.object({
  id: id.optional(),
  name: label,
  parentId: id.nullable().default(null),
  kind: z.enum(["income", "expense", "both"]),
});
export const budgetInput = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  category: label,
  amount: money.nonnegative(),
});
export const ruleChange = z
  .object({
    ruleId: id,
    effective: date,
    amount: money.positive().optional(),
    skip: z.boolean(),
  })
  .refine(
    (v) => v.skip || v.amount !== undefined,
    "Zadajte novú sumu alebo výnimku.",
  );
export type AssetInput = z.infer<typeof assetInput>;
export type ContractInput = z.infer<typeof contractInput>;
export type CategoryInput = z.infer<typeof categoryInput>;
export type BudgetInput = z.infer<typeof budgetInput>;
export type RuleChange = z.infer<typeof ruleChange>;
export type Asset = Omit<AssetInput, "id"> & {
  id: string;
  archived: number;
  income: number;
  expenses: number;
};
export type Contract = Omit<ContractInput, "id"> & {
  id: string;
  archived: number;
};
export type Category = Omit<CategoryInput, "id"> & { id: string };
export type Budget = BudgetInput & {
  id: string;
  actual: number;
  remaining: number;
};
export type Rule = {
  id: string;
  name: string;
  amount: number;
  start: string;
  end: string | null;
  interval: number;
  asset_id: string | null;
  contract_id: string | null;
  active: number;
  direction: "income" | "expense";
};
export type DomainSnapshot = {
  assets: Asset[];
  contracts: Contract[];
  categories: Category[];
  budgets: Budget[];
  rules: Rule[];
};
export interface DomainApi {
  domainSnapshot(): Promise<DomainSnapshot>;
  confirmContract(v: {
    documentId: string;
    contract: ContractInput;
    rule?: RuleInput;
  }): Promise<string>;
  saveAsset(v: AssetInput): Promise<string>;
  saveContract(v: ContractInput): Promise<string>;
  saveCategory(v: CategoryInput): Promise<string>;
  saveBudget(v: BudgetInput): Promise<void>;
  archiveEntity(v: {
    kind: "asset" | "contract" | "account";
    id: string;
    archived?: boolean;
  }): Promise<void>;
  cancelPayable(id: string): Promise<void>;
  stopRule(id: string): Promise<void>;
  changeRule(v: RuleChange): Promise<void>;
  voidTransaction(id: string): Promise<void>;
}

export const contractConfirmation = z.object({
  documentId: id,
  contract: contractInput,
  rule: ruleInput.optional(),
});
