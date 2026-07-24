import { describe, it, expect } from "vitest";
import { productCreateSchema, taxRateCreateSchema } from "./schema";

describe("productos — schema", () => {
  it("acepta un producto mínimo válido y castea números", () => {
    const r = productCreateSchema.safeParse({ kind: "good", name: "Café", price: "12.50" });
    expect(r.success).toBe(true);
    if (r.success) { expect(r.data.price).toBe(12.5); expect(r.data.unit).toBe("unidad"); }
  });
  it("rechaza name vacío y kind inválido", () => {
    expect(productCreateSchema.safeParse({ kind: "good", name: "", price: "1" }).success).toBe(false);
    expect(productCreateSchema.safeParse({ kind: "x", name: "A", price: "1" }).success).toBe(false);
  });
  it("rechaza price negativo y normaliza sku/category vacíos a null/undefined", () => {
    expect(productCreateSchema.safeParse({ kind: "good", name: "A", price: "-5" }).success).toBe(false);
    const r = productCreateSchema.safeParse({ kind: "service", name: "Corte", price: "0", sku: "", categoryId: "", taxRateId: "" });
    expect(r.success).toBe(true);
    if (r.success) { expect(r.data.sku).toBeUndefined(); expect(r.data.categoryId).toBeNull(); }
  });
  it("taxRate: rate fuera de 0–100 falla", () => {
    expect(taxRateCreateSchema.safeParse({ name: "IVA", rate: "16" }).success).toBe(true);
    expect(taxRateCreateSchema.safeParse({ name: "IVA", rate: "150" }).success).toBe(false);
  });
});
