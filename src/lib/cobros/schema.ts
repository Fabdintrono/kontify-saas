import { z } from "zod";
import { isDateISO } from "@/lib/tz";

const optStr = (max: number) =>
  z.preprocess((v) => (v == null || (typeof v === "string" && v.trim() === "") ? undefined : v),
    z.string().trim().max(max).optional());

const optDate =
  z.preprocess((v) => (v == null || (typeof v === "string" && v.trim() === "") ? undefined : v),
    z.string().refine(isDateISO, "Fecha inválida").optional());

export const paymentCreateSchema = z.object({
  saleId: z.string().guid("Venta requerida"),
  amount: z.coerce.number().positive("El monto debe ser mayor a 0"),
  method: optStr(40),
  reference: optStr(60),
  paidAt: optDate,
  notes: optStr(500),
});
export type PaymentInput = z.infer<typeof paymentCreateSchema>;

export const dueDateSchema = z.object({
  saleId: z.string().guid(),
  dueDate: z.preprocess((v) => (v === "" || v === "null" || v === undefined ? null : v),
    z.string().refine(isDateISO, "Fecha inválida").nullable()),
});
