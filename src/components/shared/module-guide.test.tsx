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
    expect(screen.getByRole("dialog", { name: /cómo funciona ventas/i })).toBeTruthy();
    expect(screen.getByText("Elige el cliente o deja «Consumidor final».")).toBeTruthy();
    expect(screen.getByText(/no es una factura fiscal/i)).toBeTruthy();
    expect(screen.getAllByRole("listitem").length).toBeGreaterThanOrEqual(GUIDES.ventas.steps.length);
  });
  it("sin pasos no renderiza nada", () => {
    const { container } = render(<ModuleGuide guide={GUIDES.config_tasas} />);
    expect(container.innerHTML).toBe("");
  });
});
