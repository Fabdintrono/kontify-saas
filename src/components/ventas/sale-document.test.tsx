// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { SaleDocument } from "./sale-document";

afterEach(cleanup);
const sale = {
  number: 7, status: "issued", currency: "USD", notes: null, payment_method: "Efectivo",
  total: 25.4, paid_amount: 25.4, due_date: null,
  clients: { name: "María" }, branches: { name: "Principal" },
  items: [{ id: "1", description: "Agua mineral 1.5L", quantity: 12, unit_price: 1.2, discount_pct: 0, tax_rate: 16 }],
  computed: { subtotal: 14.4, discountTotal: 0, taxTotal: 2.3, total: 16.7, lines: [{ neto: 14.4 }] },
};

describe("SaleDocument", () => {
  it("en móvil cada línea es una tarjeta con sus valores rotulados", () => {
    const { container } = render(<SaleDocument sale={sale as never} paymentStatus="pagada" />);
    // la tabla existe pero solo desde lg
    expect(container.querySelector("table")?.className).toMatch(/hidden|lg:table/);
    // y hay una lista de tarjetas para móvil
    const cards = container.querySelector("[data-lineas-movil]");
    expect(cards).not.toBeNull();
    expect(cards?.className).toMatch(/lg:hidden/);
    expect(screen.getAllByText("Agua mineral 1.5L").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Cant\./).length).toBeGreaterThanOrEqual(1);
  });
});
