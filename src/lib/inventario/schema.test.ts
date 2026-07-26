import { describe, it, expect } from "vitest";
import { adjustmentSchema } from "./schema";

const pid = "11111111-1111-1111-1111-111111111111";
const bid = "22222222-2222-2222-2222-222222222222";

describe("inventario — schema", () => {
  it("acepta un ajuste válido y castea quantity", () => {
    const r = adjustmentSchema.safeParse({ productId: pid, branchId: bid, direction: "in", quantity: "5" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.quantity).toBe(5);
  });
  it("rechaza quantity <= 0 y direction inválida", () => {
    expect(adjustmentSchema.safeParse({ productId: pid, branchId: bid, direction: "out", quantity: 0 }).success).toBe(false);
    expect(adjustmentSchema.safeParse({ productId: pid, branchId: bid, direction: "x", quantity: 1 }).success).toBe(false);
  });
  it("exige productId y branchId", () => {
    expect(adjustmentSchema.safeParse({ direction: "in", quantity: 1 }).success).toBe(false);
  });
});
