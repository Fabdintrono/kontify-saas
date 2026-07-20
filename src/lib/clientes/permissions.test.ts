import { describe, it, expect } from "vitest";
import { canArchiveClient, canManageClientTypes } from "@/lib/clientes/permissions";

describe("permisos de clientes", () => {
  it("solo owner/admin archivan clientes", () => {
    expect(canArchiveClient("owner")).toBe(true);
    expect(canArchiveClient("admin")).toBe(true);
    expect(canArchiveClient("administrativo")).toBe(false);
    expect(canArchiveClient("vendedor")).toBe(false);
  });
  it("solo owner/admin gestionan tipos", () => {
    expect(canManageClientTypes("owner")).toBe(true);
    expect(canManageClientTypes("vendedor")).toBe(false);
  });
});
