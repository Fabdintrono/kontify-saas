import { z } from "zod";

const optStr = (max: number) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().max(max).optional());

const optId =
  z.preprocess((v) => (v === "" || v === "null" || v === undefined ? null : v),
    z.string().guid().nullable().optional());

export const saleLineSchema = z.object({
  productId: optId,
  description: z.string().trim().min(1, "Descripción requerida").max(160),
  quantity: z.coerce.number().positive("Cantidad debe ser > 0"),
  unitPrice: z.coerce.number().min(0, "Precio ≥ 0"),
  discountPct: z.coerce.number().min(0).max(100).default(0),
  taxRate: z.coerce.number().min(0).max(100).default(0),
});
export type SaleLineInputZ = z.infer<typeof saleLineSchema>;

export const saleSaveSchema = z.object({
  clientId: optId,
  branchId: z.string().guid("Sucursal requerida"),
  globalDiscountPct: z.coerce.number().min(0).max(100).default(0),
  notes: optStr(1000),
  items: z.array(saleLineSchema),
});
export type SaleSaveInput = z.infer<typeof saleSaveSchema>;

export const saleEmitSchema = saleSaveSchema.extend({
  items: z.array(saleLineSchema).min(1, "Agrega al menos una línea"),
});

export const emitSchema = z.object({
  paymentType: z.enum(["contado", "credito"], { message: "Tipo de pago inválido" }),
  paymentMethod: optStr(40),
});
export type EmitInput = z.infer<typeof emitSchema>;
