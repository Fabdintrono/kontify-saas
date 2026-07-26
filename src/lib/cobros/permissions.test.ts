import { describe, it, expect } from "vitest";
import { canRegisterPayment, canVoidPayment, canEditDueDate } from "./permissions";

describe("cobros — permissions", () => {
  it("canRegisterPayment: back-office sí; vendedor/cajero/almacen no", () => {
    expect(["owner", "admin", "administrativo"].every(canRegisterPayment as any)).toBe(true);
    expect(canRegisterPayment("vendedor")).toBe(false);
    expect(canRegisterPayment("cajero")).toBe(false);
    expect(canRegisterPayment("almacen")).toBe(false);
  });
  it("canVoidPayment solo owner/admin", () => {
    expect(canVoidPayment("owner")).toBe(true);
    expect(canVoidPayment("admin")).toBe(true);
    expect(canVoidPayment("administrativo")).toBe(false);
  });
  it("canEditDueDate: back-office", () => {
    expect(canEditDueDate("administrativo")).toBe(true);
    expect(canEditDueDate("vendedor")).toBe(false);
  });
});
