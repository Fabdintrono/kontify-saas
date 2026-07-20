import { describe, it, expect } from "vitest";
import { canAccess, isBranchScoped, ROLES } from "@/lib/auth/roles";

describe("roles", () => {
  it("owner y admin acceden a todo", () => {
    expect(canAccess("owner", "billing")).toBe(true);
    expect(canAccess("admin", "finanzas")).toBe(true);
  });
  it("administrativo entra a finanzas pero no a caja ni billing", () => {
    expect(canAccess("administrativo", "finanzas")).toBe(true);
    expect(canAccess("administrativo", "caja")).toBe(false);
    expect(canAccess("administrativo", "billing")).toBe(false);
  });
  it("cajero/vendedor/almacen están scoped a sucursal", () => {
    expect(isBranchScoped("cajero")).toBe(true);
    expect(isBranchScoped("vendedor")).toBe(true);
    expect(isBranchScoped("almacen")).toBe(true);
    expect(isBranchScoped("owner")).toBe(false);
  });
  it("ROLES lista los 6 roles de tenant", () => {
    expect(ROLES).toHaveLength(6);
  });
});
