import { z } from "zod";
import { saleLineSchema } from "@/lib/ventas/schema";

const optStr = (max: number) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().max(max).optional());

const optId =
  z.preprocess((v) => (v === "" || v === "null" || v === undefined ? null : v),
    z.string().guid().nullable().optional());

const optDate =
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida").nullable().optional());

export const quoteSaveSchema = z.object({
  clientId: optId,
  branchId: z.string().guid("Sucursal requerida"),
  globalDiscountPct: z.coerce.number().min(0).max(100).default(0),
  validUntil: optDate,
  notes: optStr(1000),
  items: z.array(saleLineSchema),
});
export type QuoteSaveInput = z.infer<typeof quoteSaveSchema>;

export const quoteSendSchema = quoteSaveSchema.extend({
  items: z.array(saleLineSchema).min(1, "Agrega al menos una línea"),
});

export const quoteStatusSchema = z.object({
  status: z.enum(["accepted", "rejected"], { message: "Estado inválido" }),
});
