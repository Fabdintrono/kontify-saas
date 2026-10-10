// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { Inbox } from "lucide-react";
import { EmptyState } from "./empty-state";

afterEach(cleanup);

describe("EmptyState", () => {
  it("muestra título y pista (compatibilidad)", () => {
    render(<EmptyState icon={Inbox} title="Sin datos aún" hint="Vuelve pronto" />);
    expect(screen.getByText("Sin datos aún")).toBeTruthy();
    expect(screen.getByText("Vuelve pronto")).toBeTruthy();
  });
  it("con action renderiza un enlace primario con el símbolo +", () => {
    render(<EmptyState icon={Inbox} title="Tu catálogo está vacío" action={{ href: "/operaciones/productos/nuevo", label: "Nuevo producto" }} />);
    const a = screen.getByRole("link", { name: /nuevo producto/i });
    expect(a.getAttribute("href")).toBe("/operaciones/productos/nuevo");
  });
  it("acepta un secundario (p. ej. el enlace de ayuda) y el tono ok", () => {
    const { container } = render(<EmptyState icon={Inbox} title="Nadie te debe" tone="ok" secondary={<span>ayuda</span>} />);
    expect(screen.getByText("ayuda")).toBeTruthy();
    expect(container.querySelector("svg")?.getAttribute("class")).toMatch(/0f766e/);
  });
});
