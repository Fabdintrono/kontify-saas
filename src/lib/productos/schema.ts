import { z } from "zod";

export const PRODUCT_KINDS = ["good", "service"] as const;

const optStr = (max: number) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().max(max).optional());

const optId =
  z.preprocess((v) => (v === "" || v === "null" || v === undefined ? null : v),
    z.string().uuid().nullable().optional());

const reqNum =
  z.preprocess((v) => (v === "" || v === null || v === undefined ? 0 : v),
    z.coerce.number().min(0, "Debe ser ≥ 0"));

const optNum =
  z.preprocess((v) => (v === "" || v === null || v === undefined ? undefined : v),
    z.coerce.number().min(0, "Debe ser ≥ 0").optional());

const unitField =
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? "unidad" : v),
    z.string().trim().min(1).max(20).default("unidad"));

export const productCreateSchema = z.object({
  kind: z.enum(PRODUCT_KINDS, { message: "Tipo inválido" }),
  name: z.string().trim().min(1, "El nombre es obligatorio").max(120),
  sku: optStr(40),
  description: optStr(500),
  unit: unitField,
  categoryId: optId,
  price: reqNum,
  cost: optNum,
  taxRateId: optId,
});
export type ProductInput = z.infer<typeof productCreateSchema>;

export const productUpdateSchema = productCreateSchema; // el form de edición envía todos los campos

export const categoryCreateSchema = z.object({
  name: z.string().trim().min(1, "Nombre requerido").max(40),
});
export type CategoryInput = z.infer<typeof categoryCreateSchema>;

export const categoryUpdateSchema = z.object({
  name: z.string().trim().min(1).max(40).optional(),
  active: z.boolean().optional(),
});

export const taxRateCreateSchema = z.object({
  name: z.string().trim().min(1, "Nombre requerido").max(40),
  rate: z.coerce.number().min(0).max(100, "Entre 0 y 100"),
  isDefault: z.boolean().optional(),
});
export type TaxRateInput = z.infer<typeof taxRateCreateSchema>;

export const taxRateUpdateSchema = z.object({
  name: z.string().trim().min(1).max(40).optional(),
  rate: z.coerce.number().min(0).max(100).optional(),
  isDefault: z.boolean().optional(),
  active: z.boolean().optional(),
});
