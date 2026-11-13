import { z } from "zod";
import { date, money, id } from "./primitives";
export const aiTask = z.enum([
  "classification",
  "contract_extraction",
  "receipt_items",
  "financial_analysis",
  "summary",
]);
export const aiConfiguration = z.object({
  id: id.optional(),
  name: z.string().trim().min(1).max(120),
  kind: z.enum(["openai", "anthropic", "gemini", "ollama", "compatible"]),
  model: z.string().trim().min(1).max(200),
  baseUrl: z.string().max(1000).default(""),
  cloudConsent: z.boolean().default(false),
  structuredOutput: z.boolean().default(true),
  timeoutMs: z.number().int().min(1000).max(180000).default(30000),
  maxAttempts: z.number().int().min(1).max(3).default(1),
  maxOutputTokens: z.number().int().min(256).max(16384).default(2048),
  tokenBudget: z.number().int().min(1).max(1000000000).default(1000000),
  inputPriceMicros: money.nonnegative().nullable().default(null),
  outputPriceMicros: money.nonnegative().nullable().default(null),
  costBudgetMicros: money.positive().nullable().default(null),
});
export const aiRoute = z
  .object({
    task: aiTask,
    primaryId: id,
    fallbackId: id.nullable().default(null),
    allowFallback: z.boolean().default(false),
  })
  .refine((v) => v.primaryId !== v.fallbackId, "Záložný model musí byť iný.");
export const aiOutput = z
  .object({
    documentType: z.enum([
      "invoice",
      "receipt",
      "insurance",
      "loan",
      "rental",
      "service",
      "other_contract",
      "other",
      "unknown",
    ]),
    name: z.string().max(500).nullable(),
    amountCents: money.positive().nullable(),
    date: date.nullable(),
    intervalMonths: z.number().int().min(0).max(120).nullable(),
    summary: z.string().max(10000),
    items: z
      .array(
        z
          .object({
            name: z.string().max(500),
            quantity: z.string().max(50).nullable(),
            amountCents: money.nonnegative().nullable(),
          })
          .strict(),
      )
      .max(500),
  })
  .strict();
export type AIOutput = z.infer<typeof aiOutput>;
export type AIConfiguration = z.infer<typeof aiConfiguration>;
export type AIRoute = z.infer<typeof aiRoute>;
export type AITask = z.infer<typeof aiTask>;
export type AIState = {
  configurations: (AIConfiguration & {
    id: string;
    hasKey: boolean;
    spentTokens: number;
  })[];
  routes: AIRoute[];
  usage: {
    providerId: string;
    task: string;
    inputTokens: number | null;
    outputTokens: number | null;
    costMicros: number | null;
    createdAt: string;
  }[];
  secureStorage: boolean;
};
export interface AIApi {
  aiState(): Promise<AIState>;
  saveAI(v: {
    configuration: AIConfiguration;
    apiKey?: string;
  }): Promise<string>;
  saveAIRoute(v: AIRoute): Promise<void>;
  testAI(id: string): Promise<AIOutput>;
  runDocumentAI(v: {
    documentId: string;
    task: AITask;
    approvedProviders: string[];
  }): Promise<void>;
}
