// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { ToastProvider, useToast } from "./toast";

afterEach(cleanup);

function Demo() {
  const { toast } = useToast();
  return <button onClick={() => toast({ title: "Venta #4 emitida", href: "/operaciones/facturacion/x" })}>go</button>;
}

describe("Toast", () => {
  it("muestra el título, un enlace Ver y se puede cerrar", () => {
    render(<ToastProvider><Demo /></ToastProvider>);
    fireEvent.click(screen.getByText("go"));
    expect(screen.getByText("Venta #4 emitida")).toBeTruthy();
    expect(screen.getByText("Ver").getAttribute("href")).toBe("/operaciones/facturacion/x");
    fireEvent.click(screen.getByLabelText("Cerrar aviso"));
    expect(screen.queryByText("Venta #4 emitida")).toBeNull();
  });
  it("se cierra solo a los 4 segundos", async () => {
    render(<ToastProvider><Demo /></ToastProvider>);
    fireEvent.click(screen.getByText("go"));
    await act(async () => { await new Promise((r) => setTimeout(r, 4300)); });
    expect(screen.queryByText("Venta #4 emitida")).toBeNull();
  }, 10000);
});
