import { describe, it, expect } from "vitest";
import { saleLineSchema, saleSaveSchema, saleEmitSchema, emitSchema } from "./schema";

const line = { productId: null, description: "Café", quantity: 1, unitPrice: 10, discountPct: 0, taxRate: 16 };
const base = { clientId: null, branchId: "00000000-0000-0000-0000-000000000001", globalDiscountPct: 0, notes: "", items: [line] };

describe("ventas — schema", () => {
  it("línea válida y castea números", () => {
    const r = saleLineSchema.safeParse({ ...line, quantity: "2", unitPrice: "9.5" });
    expect(r.success).toBe(true);
    if (r.success) { expect(r.data.quantity).toBe(2); expect(r.data.unitPrice).toBe(9.5); }
  });
  it("línea rechaza quantity 0 o negativa", () => {
    expect(saleLineSchema.safeParse({ ...line, quantity: 0 }).success).toBe(false);
    expect(saleLineSchema.safeParse({ ...line, quantity: -1 }).success).toBe(false);
  });
  it("saleSaveSchema permite 0 líneas; saleEmitSchema exige ≥1", () => {
    expect(saleSaveSchema.safeParse({ ...base, items: [] }).success).toBe(true);
    expect(saleEmitSchema.safeParse({ ...base, items: [] }).success).toBe(false);
    expect(saleEmitSchema.safeParse(base).success).toBe(true);
  });
  it("emitSchema valida paymentType", () => {
    expect(emitSchema.safeParse({ paymentType: "contado", paymentMethod: "efectivo" }).success).toBe(true);
    expect(emitSchema.safeParse({ paymentType: "credito" }).success).toBe(true);
    expect(emitSchema.safeParse({ paymentType: "otro" }).success).toBe(false);
  });
});
