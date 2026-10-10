// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ToastProvider } from "@/components/ui/toast";
import { GettingStarted } from "./getting-started";

afterEach(cleanup);
// El paso de equipo es `available: false` (su pantalla aún no existe): se muestra sin enlace.
const items = (done: boolean[]) => ([
  { key: "producto", label: "Crea tu primer producto", href: "/operaciones/productos/nuevo", done: done[0], available: true },
  { key: "existencias", label: "Carga existencias en Inventario", href: "/operaciones/inventario", done: done[1], available: true },
  { key: "cliente", label: "Registra un cliente", href: "/clientes/nuevo", done: done[2], available: true },
  { key: "venta", label: "Haz tu primera venta", href: "/operaciones/facturacion/nueva", done: done[3], available: true },
  { key: "equipo", label: "Invita a tu equipo (pronto)", href: "/configuracion/usuarios", done: done[4], available: false },
] as const);

describe("GettingStarted", () => {
  it("muestra progreso, enlaza los pendientes y no ofrece Ocultar antes del 100 %", () => {
    render(<ToastProvider><GettingStarted status={{ items: [...items([true, false, false, false, false])], done: 1, total: 5, complete: false, hidden: false }} canHide action={vi.fn(async () => {})} /></ToastProvider>);
    expect(screen.getByText("1 de 5")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Carga existencias/ }).getAttribute("href")).toBe("/operaciones/inventario");
    expect(screen.queryByRole("button", { name: /ocultar/i })).toBeNull();
  });
  it("el paso que aún no tiene pantalla se ve pero no es enlace", () => {
    render(<ToastProvider><GettingStarted status={{ items: [...items([false, false, false, false, false])], done: 0, total: 5, complete: false, hidden: false }} canHide action={vi.fn(async () => {})} /></ToastProvider>);
    expect(screen.getByText("Invita a tu equipo (pronto)")).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Invita a tu equipo/ })).toBeNull();
    expect(screen.getAllByRole("link")).toHaveLength(4);
  });
  it("al 100 % de lo disponible ofrece Ocultar solo a quien puede, con el equipo aún pendiente", () => {
    const all = { items: [...items([true, true, true, true, false])], done: 4, total: 5, complete: true, hidden: false };
    const { rerender } = render(<ToastProvider><GettingStarted status={all} canHide action={vi.fn(async () => {})} /></ToastProvider>);
    expect(screen.getByText("4 de 5")).toBeTruthy();
    expect(screen.getByRole("button", { name: /ocultar/i })).toBeTruthy();
    rerender(<ToastProvider><GettingStarted status={all} canHide={false} action={vi.fn(async () => {})} /></ToastProvider>);
    expect(screen.queryByRole("button", { name: /ocultar/i })).toBeNull();
  });
});
