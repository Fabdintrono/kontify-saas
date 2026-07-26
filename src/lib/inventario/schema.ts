import { z } from "zod";

const optStr = (max: number) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().max(max).optional());

export const adjustmentSchema = z.object({
  productId: z.string().guid("Producto requerido"),
  branchId: z.string().guid("Sucursal requerida"),
  direction: z.enum(["in", "out"], { message: "Dirección inválida" }),
  quantity: z.coerce.number().positive("La cantidad debe ser mayor a 0"),
  reason: optStr(200),
});
export type AdjustmentInput = z.infer<typeof adjustmentSchema>;
