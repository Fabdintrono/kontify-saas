// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { ToastProvider, useToast } from "./toast";

afterEach(() => { cleanup(); vi.useRealTimers(); });

function Demo({ href, tone }: { href?: string; tone?: "success" | "error" }) {
  const { toast } = useToast();
  return <button onClick={() => toast({ title: "Venta #4 emitida", href, tone })}>go</button>;
}

describe("Toast", () => {
  it("muestra el título, un enlace Ver y se puede cerrar", () => {
    render(<ToastProvider><Demo href="/operaciones/facturacion/x" /></ToastProvider>);
    fireEvent.click(screen.getByText("go"));
    expect(screen.getByText("Venta #4 emitida")).toBeTruthy();
    expect(screen.getByText("Ver").getAttribute("href")).toBe("/operaciones/facturacion/x");
    fireEvent.click(screen.getByLabelText("Cerrar aviso"));
    expect(screen.queryByText("Venta #4 emitida")).toBeNull();
  });
  it("sin enlace se cierra solo a los 4 segundos", () => {
    vi.useFakeTimers();
    render(<ToastProvider><Demo /></ToastProvider>);
    fireEvent.click(screen.getByText("go"));
    expect(screen.getByText("Venta #4 emitida")).toBeTruthy();
    act(() => { vi.advanceTimersByTime(4500); });
    expect(screen.queryByText("Venta #4 emitida")).toBeNull();
  });
  it("con enlace no se cierra solo: hay que darle tiempo de pulsar Ver", () => {
    vi.useFakeTimers();
    render(<ToastProvider><Demo href="/operaciones/facturacion/x" /></ToastProvider>);
    fireEvent.click(screen.getByText("go"));
    act(() => { vi.advanceTimersByTime(4500); });
    expect(screen.getByText("Venta #4 emitida")).toBeTruthy();
  });
  it("un error no se cierra solo y se anuncia en el canal assertive", () => {
    vi.useFakeTimers();
    const { container } = render(<ToastProvider><Demo tone="error" /></ToastProvider>);
    fireEvent.click(screen.getByText("go"));
    const assertive = container.ownerDocument.querySelector('[data-toast-region="assertive"]')!;
    expect(assertive.getAttribute("aria-live")).toBe("assertive");
    expect(assertive.textContent).toContain("Venta #4 emitida");
    expect(container.ownerDocument.querySelector('[data-toast-region="polite"]')!.textContent).toBe("");
    act(() => { vi.advanceTimersByTime(4500); });
    expect(screen.getByText("Venta #4 emitida")).toBeTruthy();
  });
});
