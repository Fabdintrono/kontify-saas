import { z } from "zod";
import { isDateISO } from "@/lib/tz";

export const FRECUENCIAS = ["semanal", "quincenal", "mensual", "bimestral", "trimestral", "anual"] as const;
export type Frecuencia = (typeof FRECUENCIAS)[number];

export const FRECUENCIA_LABEL: Record<Frecuencia, string> = {
  semanal: "Cada semana",
  quincenal: "Cada quincena",
  mensual: "Cada mes",
  bimestral: "Cada dos meses",
  trimestral: "Cada tres meses",
  anual: "Cada año",
};

const optStr = (max: number) =>
  z.preprocess((v) => (v == null || (typeof v === "string" && v.trim() === "") ? undefined : v),
    z.string().trim().max(max).optional());

const optId =
  z.preprocess((v) => (v === "" || v === "null" || v == null ? null : v),
    z.string().guid().nullable().optional());

const fecha = z.string().refine(isDateISO, "Fecha inválida");

// El monto llega del formulario como texto; `coerce` lo convierte y la cota lo valida.
// Se exige mayor que cero: un gasto de cero no es un gasto, es un error de carga.
const monto = z.coerce.number({ message: "Escribe un monto" })
  .positive("El monto debe ser mayor que cero")
  .max(99_999_999_999.99, "El monto es demasiado grande");

export const expenseCreateSchema = z.object({
  description: z.string().trim().min(1, "Di en qué se gastó").max(200),
  amount: monto,
  spentOn: fecha,
  categoryId: optId,
  paymentMethod: optStr(40),
  supplier: optStr(120),
  notes: optStr(500),
});
export type ExpenseInput = z.infer<typeof expenseCreateSchema>;

export const expenseUpdateSchema = expenseCreateSchema.extend({
  id: z.string().guid(),
});

export const recurringCreateSchema = z.object({
  description: z.string().trim().min(1, "Di qué gasto fijo es").max(200),
  amount: monto,
  frequency: z.enum(FRECUENCIAS, { message: "Elige cada cuánto se paga" }),
  nextDue: fecha,
  categoryId: optId,
});
export type RecurringInput = z.infer<typeof recurringCreateSchema>;

export const recurringUpdateSchema = recurringCreateSchema.extend({
  id: z.string().guid(),
  active: z.preprocess((v) => v === "true" || v === true, z.boolean()).optional(),
});

export const expenseCategorySchema = z.object({
  name: z.string().trim().min(1, "Nombre requerido").max(40),
});
