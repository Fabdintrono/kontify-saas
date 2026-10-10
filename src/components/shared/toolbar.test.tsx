// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { SearchField, Toolbar } from "./toolbar";

beforeEach(() => vi.useFakeTimers());
afterEach(() => { cleanup(); vi.useRealTimers(); });

function type(v: string) {
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: v } });
}

describe("SearchField", () => {
  it("espera a que pare de escribir antes de buscar", () => {
    const onSearch = vi.fn();
    render(<SearchField label="Buscar clientes" placeholder="…" value="" onSearch={onSearch} />);

    type("a"); type("an"); type("ana");
    expect(onSearch).not.toHaveBeenCalled();

    act(() => { vi.advanceTimersByTime(300); });
    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onSearch).toHaveBeenCalledWith("ana");
  });

  it("Enter busca de inmediato, sin esperar el rebote", () => {
    const onSearch = vi.fn();
    render(<SearchField label="Buscar clientes" placeholder="…" value="" onSearch={onSearch} />);

    type("ana");
    fireEvent.keyDown(screen.getByRole("searchbox"), { key: "Enter" });
    expect(onSearch).toHaveBeenCalledWith("ana");

    // Y el rebote pendiente ya no dispara una segunda consulta con lo mismo.
    act(() => { vi.advanceTimersByTime(300); });
    expect(onSearch).toHaveBeenCalledTimes(1);
  });

  it("volver al mismo término no dispara ninguna consulta", () => {
    const onSearch = vi.fn();
    render(<SearchField label="Buscar clientes" placeholder="…" value="ana" onSearch={onSearch} />);

    type("an"); type("ana");
    act(() => { vi.advanceTimersByTime(300); });
    expect(onSearch).not.toHaveBeenCalled();
  });

  it("tiene etiqueta accesible aunque no se vea", () => {
    render(<SearchField label="Buscar ventas" placeholder="…" value="" onSearch={() => {}} />);
    expect(screen.getByLabelText("Buscar ventas")).toBeTruthy();
  });
});

describe("Toolbar", () => {
  it("mientras navega se marca ocupada y se atenúa", () => {
    const { container } = render(<Toolbar pending><span>x</span></Toolbar>);
    const barra = container.firstElementChild as HTMLElement;
    expect(barra.getAttribute("aria-busy")).toBe("true");
    expect(barra.className).toContain("opacity-60");
  });

  it("en reposo no declara aria-busy", () => {
    const { container } = render(<Toolbar pending={false}><span>x</span></Toolbar>);
    expect((container.firstElementChild as HTMLElement).hasAttribute("aria-busy")).toBe(false);
  });
});
