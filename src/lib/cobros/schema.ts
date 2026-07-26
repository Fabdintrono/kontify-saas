import { z } from "zod";

const optStr = (max: number) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().max(max).optional());

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const todayISO = () => new Date().toISOString().slice(0, 10);

const optDate =
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().regex(DATE_RE, "Fecha inválida").optional());

export const paymentCreateSchema = z.object({
  saleId: z.string().guid("Venta requerida"),
  amount: z.coerce.number().positive("El monto debe ser mayor a 0"),
  method: optStr(40),
  reference: optStr(60),
  paidAt: optDate.refine((v) => !v || v <= todayISO(), "La fecha no puede ser futura"),
  notes: optStr(500),
});
export type PaymentInput = z.infer<typeof paymentCreateSchema>;

export const dueDateSchema = z.object({
  saleId: z.string().guid(),
  dueDate: z.preprocess((v) => (v === "" || v === "null" || v === undefined ? null : v),
    z.string().regex(DATE_RE, "Fecha inválida").nullable()),
});
