// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ModuleHeader } from "./module-header";

afterEach(cleanup);

describe("ModuleHeader", () => {
  it("muestra título, subtítulo, el enlace de ayuda y las acciones", () => {
    render(<ModuleHeader module="clientes" actions={<a href="/clientes/nuevo">Nuevo cliente</a>} />);
    expect(screen.getByRole("heading", { level: 1, name: "Clientes" })).toBeTruthy();
    expect(screen.getByText(/Personas o empresas a las que vendes/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /cómo funciona/i })).toBeTruthy();
    expect(screen.getByText("Nuevo cliente")).toBeTruthy();
  });
  it("permite sobrescribir el título (p. ej. con un nombre de cliente)", () => {
    render(<ModuleHeader module="cuentas_por_cobrar" title="Distribuidora El Sol" />);
    expect(screen.getByRole("heading", { level: 1, name: "Distribuidora El Sol" })).toBeTruthy();
  });
});
