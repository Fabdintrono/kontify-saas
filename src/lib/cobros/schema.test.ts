import { describe, it, expect } from "vitest";
import { paymentCreateSchema, dueDateSchema } from "./schema";

const sid = "11111111-1111-1111-1111-111111111111";

describe("cobros — schema", () => {
  it("acepta un abono válido y castea amount", () => {
    const r = paymentCreateSchema.safeParse({ saleId: sid, amount: "50.5", method: "efectivo" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.amount).toBe(50.5);
  });
  it("rechaza amount <= 0 y saleId faltante", () => {
    expect(paymentCreateSchema.safeParse({ saleId: sid, amount: 0 }).success).toBe(false);
    expect(paymentCreateSchema.safeParse({ saleId: sid, amount: -1 }).success).toBe(false);
    expect(paymentCreateSchema.safeParse({ amount: 10 }).success).toBe(false);
  });
  it("rechaza paidAt futura", () => {
    expect(paymentCreateSchema.safeParse({ saleId: sid, amount: 10, paidAt: "2999-01-01" }).success).toBe(false);
  });
  it("dueDate acepta fecha o null", () => {
    expect(dueDateSchema.safeParse({ saleId: sid, dueDate: "2026-12-31" }).success).toBe(true);
    expect(dueDateSchema.safeParse({ saleId: sid, dueDate: "" }).success).toBe(true); // → null
  });
});
