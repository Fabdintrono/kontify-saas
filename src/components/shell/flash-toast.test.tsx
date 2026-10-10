// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import React from "react";
import { ToastProvider } from "@/components/ui/toast";

let params = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useSearchParams: () => params,
  usePathname: () => "/clientes/abc",
}));
import { FlashToast } from "./flash-toast";

afterEach(() => { cleanup(); params = new URLSearchParams(); vi.restoreAllMocks(); });

// Un elemento nuevo en cada render: React descarta el re-render si la referencia es idéntica.
const tree = () => <ToastProvider><FlashToast /></ToastProvider>;

describe("FlashToast", () => {
  it("muestra el aviso de la URL y la limpia sin navegar", () => {
    const spy = vi.spyOn(window.history, "replaceState");
    params = new URLSearchParams("flash=cliente-creado&arg=7&page=2");
    render(tree());
    expect(screen.getByText("Cliente creado")).toBeTruthy();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][2]).toBe("/clientes/abc?page=2");
  });

  it("el mismo aviso dos veces en la sesión se ve las dos veces", () => {
    params = new URLSearchParams("flash=producto-guardado");
    const { rerender } = render(tree());
    expect(screen.getAllByText("Cambios guardados")).toHaveLength(1);

    // La URL quedó limpia (el replaceState no reejecuta el efecto: lo simula este rerender).
    params = new URLSearchParams();
    rerender(tree());

    // Segundo guardado: la misma clave vuelve a la URL y debe avisar otra vez.
    params = new URLSearchParams("flash=producto-guardado");
    rerender(tree());
    expect(screen.getAllByText("Cambios guardados")).toHaveLength(2);
  });

  it("en StrictMode el efecto corre dos veces pero el aviso sale una", () => {
    params = new URLSearchParams("flash=cliente-creado");
    render(<React.StrictMode>{tree()}</React.StrictMode>);
    expect(screen.getAllByText("Cliente creado")).toHaveLength(1);
  });
});
