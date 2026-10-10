// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { KeyboardShortcuts } from "./keyboard-shortcuts";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

afterEach(() => { cleanup(); push.mockClear(); });

function montar(onOpenSearch = vi.fn()) {
  render(<KeyboardShortcuts role="owner" onOpenSearch={onOpenSearch} />);
  return onOpenSearch;
}

describe("KeyboardShortcuts", () => {
  it("una tecla lleva a su pantalla", () => {
    montar();
    fireEvent.keyDown(window, { key: "v" });
    expect(push).toHaveBeenCalledWith("/operaciones/facturacion/nueva");
  });

  it("acepta la tecla en mayúscula igual que en minúscula", () => {
    montar();
    fireEvent.keyDown(window, { key: "C" });
    expect(push).toHaveBeenCalledWith("/clientes/nuevo");
  });

  it("no dispara mientras se escribe en un campo", () => {
    montar();
    const input = document.createElement("input");
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: "v" });
    expect(push).not.toHaveBeenCalled();
    input.remove();
  });

  it("no roba las combinaciones del sistema", () => {
    montar();
    fireEvent.keyDown(window, { key: "v", ctrlKey: true });
    fireEvent.keyDown(window, { key: "v", metaKey: true });
    expect(push).not.toHaveBeenCalled();
  });

  it("Ctrl+K abre el buscador aunque el foco esté en un campo", () => {
    const abrir = montar();
    const input = document.createElement("input");
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: "k", ctrlKey: true });
    expect(abrir).toHaveBeenCalledTimes(1);
    input.remove();
  });

  it("«/» abre el buscador y «?» la lista de atajos", () => {
    const abrir = montar();
    fireEvent.keyDown(window, { key: "/" });
    expect(abrir).toHaveBeenCalledTimes(1);

    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.keyDown(window, { key: "?" });
    expect(screen.getByRole("dialog", { name: /atajos de teclado/i })).toBeTruthy();
  });

  it("un rol sin permiso no recibe el atajo de esa acción", () => {
    cleanup();
    render(<KeyboardShortcuts role="vendedor" onOpenSearch={vi.fn()} />);
    fireEvent.keyDown(window, { key: "p" }); // Nuevo producto: vendedor no gestiona catálogo
    expect(push).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: "v" }); // Nueva venta: sí puede
    expect(push).toHaveBeenCalledWith("/operaciones/facturacion/nueva");
  });
});
