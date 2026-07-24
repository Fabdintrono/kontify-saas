import { describe, it, expect } from "vitest";
import { formatMoney } from "./format";

describe("formatMoney", () => {
  it("formatea con la moneda dada", () => {
    expect(formatMoney(1234.5, "USD")).toMatch(/1[.,]234[.,]5/);
  });
  it("cae a USD ante moneda inválida sin lanzar", () => {
    expect(() => formatMoney(10, "XXX-invalid")).not.toThrow();
    expect(formatMoney(null, "USD")).toBe("—");
  });
});
