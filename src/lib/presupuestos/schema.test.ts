import { describe, it, expect } from "vitest";
import { quoteSaveSchema, quoteSendSchema, quoteStatusSchema } from "./schema";

const line = { productId: null, description: "Café", quantity: 1, unitPrice: 10, discountPct: 0, taxRate: 16 };
const base = { clientId: null, branchId: "00000000-0000-0000-0000-000000000001", globalDiscountPct: 0, notes: "", items: [line] };

describe("presupuestos — schema", () => {
  it("guardar permite 0 líneas y valida validUntil opcional", () => {
    expect(quoteSaveSchema.safeParse({ ...base, items: [] }).success).toBe(true);
    const r = quoteSaveSchema.safeParse({ ...base, validUntil: "2026-12-31" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.validUntil).toBe("2026-12-31");
    expect(quoteSaveSchema.safeParse({ ...base, validUntil: "" }).success).toBe(true); // → null
  });
  it("enviar exige ≥1 línea", () => {
    expect(quoteSendSchema.safeParse({ ...base, items: [] }).success).toBe(false);
    expect(quoteSendSchema.safeParse(base).success).toBe(true);
  });
  it("quoteStatusSchema valida accepted/rejected", () => {
    expect(quoteStatusSchema.safeParse({ status: "accepted" }).success).toBe(true);
    expect(quoteStatusSchema.safeParse({ status: "rejected" }).success).toBe(true);
    expect(quoteStatusSchema.safeParse({ status: "draft" }).success).toBe(false);
  });
});
