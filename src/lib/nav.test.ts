import { describe, it, expect } from "vitest";
import { NAV, navForRole, configForRole, resolveActiveSection } from "@/lib/nav";

describe("nav estructura", () => {
  it("tiene las 5 secciones de la IA en orden", () => {
    expect(NAV.map((s) => s.id)).toEqual(["inicio", "clientes", "operaciones", "reportes", "finanzas"]);
  });
  it("Inicio empieza en Dashboard", () => {
    expect(NAV[0].children[0].href).toBe("/dashboard");
  });
});

describe("navForRole", () => {
  it("owner ve las 5 secciones", () => {
    expect(navForRole("owner")).toHaveLength(5);
  });
  it("almacen solo ve Inicio y Operaciones", () => {
    expect(navForRole("almacen").map((s) => s.id)).toEqual(["inicio", "operaciones"]);
  });
  it("vendedor ve Inicio, Clientes y Operaciones", () => {
    expect(navForRole("vendedor").map((s) => s.id)).toEqual(["inicio", "clientes", "operaciones"]);
  });
});

describe("configForRole", () => {
  it("owner ve las 4 opciones de Configuración", () => {
    expect(configForRole("owner")!.children).toHaveLength(4);
  });
  it("cajero solo ve Preferencias dentro de Configuración", () => {
    expect(configForRole("cajero")!.children.map((c) => c.label)).toEqual(["Preferencias"]);
  });
});

describe("resolveActiveSection", () => {
  it("resuelve la sección desde el pathname", () => {
    expect(resolveActiveSection("/dashboard")?.id).toBe("inicio");
    expect(resolveActiveSection("/operaciones/facturacion")?.id).toBe("operaciones");
    expect(resolveActiveSection("/configuracion/preferencias")?.id).toBe("config");
  });
  it("devuelve null si no hay match", () => {
    expect(resolveActiveSection("/desconocido")).toBeNull();
  });
});
