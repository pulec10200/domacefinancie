import { z } from "zod";
export const money = z.number().int().safe();
export const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(v + "T00:00:00Z");
    return !Number.isNaN(+d) && d.toISOString().slice(0, 10) === v;
  }, "Invalid calendar date");
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
  requestId: z.string().uuid(),
});
export const ruleInput = z
  .object({
    name: z.string().trim().min(1),
    amount: money.refine((v) => v > 0),
    start: date,
    end: date.optional(),
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
};
export type Payable = {
  id: string;
  name: string;
  due: string;
  amount: number;
  paid: number;
};
export type Transaction = {
  id: string;
  account_id: string;
  kind: string;
  amount: number;
  date: string;
  description: string;
  category: string;
};
export type DocumentRow = {
  id: string;
  name: string;
  status: string;
  ekasa: string;
  error: string | null;
  text: string | null;
};
export type Snapshot = {
  accounts: Account[];
  transactions: Transaction[];
  payables: Payable[];
  documents: DocumentRow[];
  monthly: {
    month: string;
    income: number;
    expenses: number;
    unpaid: number;
  }[];
};
export interface DesktopApi {
  snapshot(): Promise<Snapshot>;
  addAccount(input: AccountInput): Promise<void>;
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
