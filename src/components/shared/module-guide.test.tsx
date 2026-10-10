// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ModuleGuide } from "./module-guide";
import { GUIDES } from "@/lib/guides";

afterEach(cleanup);

describe("ModuleGuide", () => {
  it("el enlace abre el panel con los pasos numerados y lo que no hace", () => {
    render(<ModuleGuide guide={GUIDES.ventas} />);
    expect(screen.queryByText("Elige el cliente o deja «Consumidor final».")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /cómo funciona/i }));
    expect(screen.getByRole("dialog", { name: /cómo funciona: ventas/i })).toBeTruthy();
    expect(screen.getByText("Elige el cliente o deja «Consumidor final».")).toBeTruthy();
    expect(screen.getByText(/no es una factura fiscal/i)).toBeTruthy();
    expect(screen.getAllByRole("listitem").length).toBeGreaterThanOrEqual(GUIDES.ventas.steps.length);
  });
  it("sin pasos no renderiza nada", () => {
    const { container } = render(<ModuleGuide guide={{ title: "X", subtitle: "Y", steps: [] }} />);
    expect(container.innerHTML).toBe("");
  });
  it("hoy los 13 módulos tienen pasos: ninguno se queda sin ayuda", () => {
    for (const id of Object.keys(GUIDES) as (keyof typeof GUIDES)[]) {
      expect(GUIDES[id].steps.length, `${id} sin pasos`).toBeGreaterThan(0);
    }
  });
  it("la variante de cabecera es un botón con nombre fijo y objetivo táctil de 44 px", () => {
    render(<ModuleGuide guide={GUIDES.ventas} variant="button" />);
    const b = screen.getByRole("button", { name: "Cómo funciona" });
    expect(b.className).toContain("max-sm:h-11");
    expect(b.className).toContain("max-sm:w-11");
  });
  it("el botón Cerrar cierra el panel", () => {
    render(<ModuleGuide guide={GUIDES.ventas} />);
    fireEvent.click(screen.getByRole("button", { name: /cómo funciona/i }));
    expect(screen.getByRole("dialog", { name: /cómo funciona: ventas/i })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /cerrar/i }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
