import { describe, it, expect } from "vitest";
import { computeSaleTotals, round2 } from "./totals";

describe("ventas — computeSaleTotals", () => {
  it("venta vacía → todo 0", () => {
    const t = computeSaleTotals([], 0);
    expect(t).toMatchObject({ subtotal: 0, discountTotal: 0, taxTotal: 0, total: 0 });
    expect(t.lines).toEqual([]);
  });
  it("sin descuentos ni impuesto", () => {
    const t = computeSaleTotals([{ quantity: 2, unitPrice: 10, discountPct: 0, taxRate: 0 }], 0);
    expect(t).toMatchObject({ subtotal: 20, discountTotal: 0, taxTotal: 0, total: 20 });
  });
  it("impuesto 16% por línea", () => {
    const t = computeSaleTotals([{ quantity: 2, unitPrice: 10, discountPct: 0, taxRate: 16 }], 0);
    expect(t.taxTotal).toBe(3.2);
    expect(t.total).toBe(23.2);
  });
  it("descuento de línea 10%", () => {
    const t = computeSaleTotals([{ quantity: 1, unitPrice: 100, discountPct: 10, taxRate: 0 }], 0);
    expect(t).toMatchObject({ subtotal: 90, discountTotal: 10, total: 90 });
  });
  it("descuento global 10%", () => {
    const t = computeSaleTotals([{ quantity: 1, unitPrice: 100, discountPct: 0, taxRate: 0 }], 10);
    expect(t).toMatchObject({ subtotal: 100, discountTotal: 10, total: 90 });
  });
  it("línea + global + impuesto (prorrateo antes del impuesto)", () => {
    const t = computeSaleTotals([{ quantity: 1, unitPrice: 100, discountPct: 10, taxRate: 16 }], 10);
    // base100, descLínea10, neto90; descGlobal9; netoFinal81; tax=12.96; total=90-9+12.96=93.96
    expect(t).toMatchObject({ subtotal: 90, discountTotal: 19, taxTotal: 12.96, total: 93.96 });
  });
  it("dos líneas con impuestos distintos: Σ tax cuadra", () => {
    const t = computeSaleTotals([
      { quantity: 1, unitPrice: 100, discountPct: 0, taxRate: 16 },
      { quantity: 1, unitPrice: 50, discountPct: 0, taxRate: 0 },
    ], 0);
    expect(t).toMatchObject({ subtotal: 150, taxTotal: 16, total: 166 });
    expect(round2(t.lines[0].tax + t.lines[1].tax)).toBe(t.taxTotal);
  });
});
