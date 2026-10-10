// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { FieldLabel } from "./field-label";

// jsdom no implementa ResizeObserver; Radix Popover lo usa internamente.
class ResizeObserverPolyfill {
  observe() {}
  unobserve() {}
  disconnect() {}
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).ResizeObserver ??= ResizeObserverPolyfill;

afterEach(cleanup);

describe("FieldLabel + FieldHelp", () => {
  it("asocia la etiqueta al input y abre la ayuda al pulsar el ?", () => {
    render(<><FieldLabel htmlFor="costo" help="costo">Costo</FieldLabel><input id="costo" /></>);
    expect(screen.getByLabelText("Costo")).toBeTruthy();
    const btn = screen.getByRole("button", { name: "Ayuda sobre Costo" });
    expect(screen.queryByText(/Lo que te cuesta a ti/)).toBeNull();
    fireEvent.click(btn);
    expect(screen.getByText(/Lo que te cuesta a ti/)).toBeTruthy();
  });
  it("sin help no renderiza el botón", () => {
    render(<><FieldLabel htmlFor="n">Nombre</FieldLabel><input id="n" /></>);
    expect(screen.queryByRole("button")).toBeNull();
  });
  it("cierra la ayuda con Escape", () => {
    render(<><FieldLabel htmlFor="costo" help="costo">Costo</FieldLabel><input id="costo" /></>);
    const btn = screen.getByRole("button", { name: "Ayuda sobre Costo" });
    fireEvent.click(btn);
    expect(screen.getByText(/Lo que te cuesta a ti/)).toBeTruthy();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    expect(screen.queryByText(/Lo que te cuesta a ti/)).toBeNull();
  });
});
