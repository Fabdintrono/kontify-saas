// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { Button, buttonCls } from "./button";

afterEach(cleanup);

describe("Button", () => {
  it("las tres variantes comparten alto y radio", () => {
    for (const v of ["primary", "secondary", "danger"] as const) {
      expect(buttonCls(v)).toMatch(/h-10/);
      expect(buttonCls(v)).toMatch(/rounded-\[10px\]/);
    }
  });
  it("primary lleva teal sólido y texto blanco; secondary borde; danger rojo", () => {
    expect(buttonCls("primary")).toMatch(/bg-\[#0e7490\]/);
    expect(buttonCls("secondary")).toMatch(/border/);
    expect(buttonCls("danger")).toMatch(/#b91c1c|#dc2626/);
  });
  // El degradado no da contraste con texto blanco (2,49:1): vive solo en elementos decorativos.
  it("primary no usa degradado", () => {
    expect(buttonCls("primary")).not.toMatch(/gradient/);
  });
  it("renderiza un botón accesible y respeta disabled", () => {
    render(<Button variant="primary" disabled>Guardar</Button>);
    const b = screen.getByRole("button", { name: "Guardar" });
    expect((b as HTMLButtonElement).disabled).toBe(true);
  });
  it("con `icon` lo pinta antes del texto y lo oculta al lector", () => {
    const { container } = render(<Button variant="primary" icon="plus">Nuevo cliente</Button>);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(screen.getByRole("button", { name: "Nuevo cliente" })).toBeTruthy();
  });
});
