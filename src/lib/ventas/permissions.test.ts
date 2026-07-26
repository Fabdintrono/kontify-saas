import { describe, it, expect } from "vitest";
import { canSell, canVoidSale } from "./permissions";

describe("ventas — permissions", () => {
  it("canSell: owner/admin/administrativo/vendedor/cajero sí; almacen no", () => {
    expect(["owner", "admin", "administrativo", "vendedor", "cajero"].every(canSell as any)).toBe(true);
    expect(canSell("almacen")).toBe(false);
  });
  it("canVoidSale solo owner/admin", () => {
    expect(canVoidSale("owner")).toBe(true);
    expect(canVoidSale("admin")).toBe(true);
    expect(canVoidSale("administrativo")).toBe(false);
    expect(canVoidSale("vendedor")).toBe(false);
    expect(canVoidSale("almacen")).toBe(false);
  });
});
