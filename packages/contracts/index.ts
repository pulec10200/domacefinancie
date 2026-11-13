import { z } from "zod";
import { money, date } from "./primitives";
export { money, date } from "./primitives";
import type { SettingsApi } from "./settings";
import type { AIApi } from "./ai";
import type { ExtractionApi } from "./extraction";
import type { DomainApi } from "./domain";
export const accountInput = z.object({
  name: z.string().trim().min(1).max(120),
  type: z.enum(["current", "savings", "cash", "credit", "other"]),
  opening: money,
  currency: z.literal("EUR").default("EUR"),
});
export const transactionInput = z.object({
  accountId: z.string().uuid(),
  targetId: z.string().uuid().optional(),
  kind: z.enum(["income", "expense", "transfer"]),
  amount: money.refine((v) => v > 0),
  date,
  description: z.string().max(500),
  category: z.string().max(120).default("Ostatné"),
  categoryId: z.string().uuid().optional(),
  assetId: z.string().uuid().optional(),
  contractId: z.string().uuid().optional(),
  requestId: z.string().uuid(),
});
export const ruleInput = z
  .object({
    name: z.string().trim().min(1),
    amount: money.refine((v) => v > 0),
    start: date,
    end: date.optional(),
    assetId: z.string().uuid().optional(),
    contractId: z.string().uuid().optional(),
    direction: z.enum(["income", "expense"]).default("expense"),
    interval: z.number().int().min(0).max(120),
  })
  .refine((v) => !v.end || v.end >= v.start, "End precedes start");
export const paymentInput = z.object({
  payableId: z.string().uuid(),
  accountId: z.string().uuid(),
  amount: money.refine((v) => v > 0),
  date,
  requestId: z.string().uuid(),
});
export const confirmationInput = z.object({
  documentId: z.string().uuid(),
  kind: z.enum(["invoice", "receipt"]),
  name: z.string().trim().min(1).max(500),
  amount: money.refine((v) => v > 0),
  date,
  accountId: z.string().uuid().optional(),
  payableId: z.string().uuid().optional(),
  assetId: z.string().uuid().optional(),
  contractId: z.string().uuid().optional(),
});
export type ConfirmationInput = z.infer<typeof confirmationInput>;
export type AccountInput = z.infer<typeof accountInput>;
export type TransactionInput = z.infer<typeof transactionInput>;
export type RuleInput = z.infer<typeof ruleInput>;
export type PaymentInput = z.infer<typeof paymentInput>;
export function parseMoney(value: string): number {
  const s = value.trim().replace(",", ".");
  if (!/^-?\d+(\.\d{1,2})?$/.test(s))
    throw Error("Zadajte sumu s najviac dvoma desatinnými miestami.");
  const negative = s.startsWith("-");
  const [a, b = ""] = s.replace("-", "").split(".");
  const n = Number(a) * 100 + Number(b.padEnd(2, "0"));
  if (!Number.isSafeInteger(n)) throw Error("Príliš vysoká suma.");
  return negative ? -n : n;
}
export type Account = {
  id: string;
  name: string;
  type: string;
  currency: string;
  opening: number;
  balance: number;
  archived: number;
};
export type Payable = {
  id: string;
  name: string;
  due: string;
  amount: number;
  paid: number;
  direction: "income" | "expense";
  rule_id: string | null;
  cancelled: number;
  estimated_amount: number | null;
  document_id: string | null;
  asset_id: string | null;
  contract_id: string | null;
};
export type Transaction = {
  id: string;
  account_id: string;
  kind: string;
  amount: number;
  date: string;
  description: string;
  category: string;
  asset_id: string | null;
  contract_id: string | null;
  category_id: string | null;
  voided: number;
  request_id: string;
};
export type DocumentRow = {
  id: string;
  name: string;
  status: string;
  ekasa: string;
  error: string | null;
  text: string | null;
  progress?: number;
  attempts?: number;
};
export type Snapshot = {
  accounts: Account[];
  transactions: Transaction[];
  transactionHistory: Transaction[];
  payables: Payable[];
  documents: DocumentRow[];
  monthly: {
    month: string;
    income: number;
    expenses: number;
    unpaid: number;
    expectedIncome: number;
    mandatory: number;
    forecast: number;
    overdue: number;
  }[];
};
export interface DesktopApi
  extends DomainApi, ExtractionApi, AIApi, SettingsApi {
  snapshot(): Promise<Snapshot>;
  exportData(): Promise<string | null>;
  addAccount(input: AccountInput): Promise<void>;
  updateAccount(input: AccountInput & { id: string }): Promise<void>;
  updateTransaction(input: TransactionInput & { id: string }): Promise<void>;
  restoreTransaction(id: string): Promise<void>;
  addTransaction(input: TransactionInput): Promise<void>;
  addRule(input: RuleInput): Promise<void>;
  pay(input: PaymentInput): Promise<void>;
  importDocument(): Promise<void>;
  watchFolder(): Promise<string | null>;
  backup(): Promise<string | null>;
  restoreBackup(): Promise<void>;
  openDocument(id: string): Promise<void>;
  openEkasa(): Promise<void>;
  confirmDocument(input: ConfirmationInput): Promise<void>;
}
