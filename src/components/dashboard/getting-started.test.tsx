// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ToastProvider } from "@/components/ui/toast";
import { GettingStarted } from "./getting-started";

afterEach(cleanup);
const items = (done: boolean[]) => ([
  { key: "producto", label: "Crea tu primer producto", href: "/operaciones/productos/nuevo", done: done[0] },
  { key: "existencias", label: "Carga existencias en Inventario", href: "/operaciones/inventario", done: done[1] },
  { key: "cliente", label: "Registra un cliente", href: "/clientes/nuevo", done: done[2] },
  { key: "venta", label: "Haz tu primera venta", href: "/operaciones/facturacion/nueva", done: done[3] },
  { key: "equipo", label: "Invita a tu equipo", href: "/configuracion/usuarios", done: done[4] },
] as const);

describe("GettingStarted", () => {
  it("muestra progreso, enlaza los pendientes y no ofrece Ocultar antes del 100 %", () => {
    render(<ToastProvider><GettingStarted status={{ items: [...items([true, false, false, false, false])], done: 1, total: 5, hidden: false }} canHide action={vi.fn(async () => {})} /></ToastProvider>);
    expect(screen.getByText("1 de 5")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Carga existencias/ }).getAttribute("href")).toBe("/operaciones/inventario");
    expect(screen.queryByRole("button", { name: /ocultar/i })).toBeNull();
  });
  it("al 100 % ofrece Ocultar solo a quien puede", () => {
    const all = { items: [...items([true, true, true, true, true])], done: 5, total: 5, hidden: false };
    const { rerender } = render(<ToastProvider><GettingStarted status={all} canHide action={vi.fn(async () => {})} /></ToastProvider>);
    expect(screen.getByRole("button", { name: /ocultar/i })).toBeTruthy();
    rerender(<ToastProvider><GettingStarted status={all} canHide={false} action={vi.fn(async () => {})} /></ToastProvider>);
    expect(screen.queryByRole("button", { name: /ocultar/i })).toBeNull();
  });
});
