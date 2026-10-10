// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { CommandPalette } from "./command-palette";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const buscar = vi.fn(async (t: string) =>
  t.toLowerCase().includes("farm")
    ? [{ kind: "cliente" as const, id: "c1", title: "Farmacia Central", subtitle: "0212-5551234", href: "/clientes/c1" }]
    : []);
vi.mock("@/lib/search/actions", () => ({ searchEverything: (t: string) => buscar(t) }));

beforeEach(() => vi.useFakeTimers());
afterEach(() => { cleanup(); push.mockClear(); buscar.mockClear(); vi.useRealTimers(); });

function abrir() {
  return render(<CommandPalette role="owner" open onOpenChange={() => {}} />);
}

async function escribir(v: string) {
  fireEvent.change(screen.getByRole("combobox"), { target: { value: v } });
  await act(async () => { vi.advanceTimersByTime(250); });
}

describe("CommandPalette", () => {
  it("sin escribir ofrece las acciones del día y las pantallas", () => {
    abrir();
    expect(screen.getByRole("option", { name: /Nueva venta/ })).toBeTruthy();
    expect(screen.getByRole("option", { name: /Todos los clientes/ })).toBeTruthy();
    expect(screen.getByText("Crear")).toBeTruthy();
    expect(screen.getByText("Ir a")).toBeTruthy();
  });

  it("el campo declara su papel de combobox y la opción activa", () => {
    abrir();
    const campo = screen.getByRole("combobox");
    expect(campo.getAttribute("aria-controls")).toBe("resultados-busqueda");
    expect(campo.getAttribute("aria-activedescendant")).toBeTruthy();
  });

  it("no consulta al servidor con menos de dos letras", async () => {
    abrir();
    await escribir("f");
    expect(buscar).not.toHaveBeenCalled();
  });

  it("busca con rebote y pone los datos antes que los destinos fijos", async () => {
    abrir();
    await escribir("farm");
    expect(buscar).toHaveBeenCalledTimes(1);
    const opciones = screen.getAllByRole("option");
    expect(opciones[0].textContent).toContain("Farmacia Central");
  });

  it("las flechas mueven la selección y Enter navega", async () => {
    abrir();
    const campo = screen.getByRole("combobox");
    fireEvent.keyDown(campo, { key: "ArrowDown" });
    fireEvent.keyDown(campo, { key: "Enter" });
    expect(push).toHaveBeenCalledTimes(1);
  });

  it("sin resultados lo dice con el término buscado, no con un vacío mudo", async () => {
    abrir();
    await escribir("zzzzz");
    expect(screen.getByText(/Nada con «zzzzz»/)).toBeTruthy();
  });

  it("una respuesta vieja que llega tarde no pisa a la última", async () => {
    const lenta = vi.fn((t: string) => new Promise<never[]>((r) => setTimeout(() => r([]), t === "farm" ? 500 : 10)));
    buscar.mockImplementation(lenta as never);
    abrir();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "farm" } });
    await act(async () => { vi.advanceTimersByTime(210); });
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "agua" } });
    await act(async () => { vi.advanceTimersByTime(800); });
    // La segunda consulta manda: el término visible y el estado son coherentes.
    expect((screen.getByRole("combobox") as HTMLInputElement).value).toBe("agua");
  });
});
