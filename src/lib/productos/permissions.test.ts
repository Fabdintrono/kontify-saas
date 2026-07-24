import { describe, it, expect } from "vitest";
import { canManageProducts, canArchiveProduct, canManageCategories, canManageTaxRates } from "./permissions";

describe("productos — permissions", () => {
  it("canManageProducts: owner/admin/administrativo/almacen sí; vendedor/cajero no", () => {
    expect(["owner", "admin", "administrativo", "almacen"].every(canManageProducts as any)).toBe(true);
    expect(canManageProducts("vendedor")).toBe(false);
    expect(canManageProducts("cajero")).toBe(false);
  });
  it("canArchiveProduct solo owner/admin", () => {
    expect(canArchiveProduct("owner")).toBe(true);
    expect(canArchiveProduct("admin")).toBe(true);
    expect(canArchiveProduct("administrativo")).toBe(false);
    expect(canArchiveProduct("almacen")).toBe(false);
  });
  it("canManageCategories / canManageTaxRates solo owner/admin", () => {
    expect(canManageCategories("admin")).toBe(true);
    expect(canManageCategories("almacen")).toBe(false);
    expect(canManageTaxRates("owner")).toBe(true);
    expect(canManageTaxRates("administrativo")).toBe(false);
  });
});
