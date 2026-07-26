import { describe, it, expect } from "vitest";
import { canManageStock } from "./permissions";

describe("inventario — permissions", () => {
  it("canManageStock: almacén + back-office; vendedor/cajero no", () => {
    expect(["owner", "admin", "administrativo", "almacen"].every(canManageStock as any)).toBe(true);
    expect(canManageStock("vendedor")).toBe(false);
    expect(canManageStock("cajero")).toBe(false);
  });
});
