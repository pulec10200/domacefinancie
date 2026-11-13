import { z } from "zod";
export const money = z.number().int().safe();
export const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const d = new Date(value + "T00:00:00Z");
    return Number.isFinite(+d) && d.toISOString().slice(0, 10) === value;
  }, "Neplatný dátum");
export const id = z.string().uuid();
export function localDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
