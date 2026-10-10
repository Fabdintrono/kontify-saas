// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, within, cleanup } from "@testing-library/react";
import { DocumentLines } from "./document-lines";
import { formatMoney } from "@/lib/format";

/** formatMoney usa NBSP entre moneda y monto; el DOM se normaliza a espacio normal al comparar. */
function money(amount: number, currency: string): string {
  return formatMoney(amount, currency).replace(/ /g, " ");
}

afterEach(cleanup);

const items = [
  { id: "1", description: "Agua mineral 1.5L", quantity: 12, unit_price: 1.2, discount_pct: 0, tax_rate: 16 },
];

describe("DocumentLines", () => {
  it("en escritorio hay tabla (oculta hasta lg) y en móvil cada línea es una tarjeta con sus valores rotulados", () => {
    const { container } = render(<DocumentLines items={items} netos={[14.4]} currency="USD" />);

    const table = container.querySelector("table");
    expect(table?.className).toMatch(/\bhidden\b/);
    expect(table?.className).toMatch(/lg:table/);

    const movil = container.querySelector("[data-lineas-movil]") as HTMLElement;
    expect(movil).not.toBeNull();
    expect(movil.className).toMatch(/lg:hidden/);

    const scope = within(movil);
    expect(scope.getByText("Agua mineral 1.5L")).toBeTruthy();
    expect(scope.getByText("Cant.")).toBeTruthy();
    expect(scope.getByText("12")).toBeTruthy();
    expect(scope.getByText("Neto")).toBeTruthy();
  });

  it("con dos líneas, el móvil muestra dos tarjetas con su neto correspondiente", () => {
    const twoItems = [
      { id: "1", description: "Agua mineral 1.5L", quantity: 12, unit_price: 1.2, discount_pct: 0, tax_rate: 16 },
      { id: "2", description: "Pan integral", quantity: 3, unit_price: 2.5, discount_pct: 0, tax_rate: 16 },
    ];
    const { container } = render(<DocumentLines items={twoItems} netos={[14.4, 7.5]} currency="USD" />);

    const movil = container.querySelector("[data-lineas-movil]") as HTMLElement;
    const cards = movil.querySelectorAll("li");
    expect(cards.length).toBe(2);

    const first = within(cards[0] as HTMLElement);
    expect(first.getByText("Agua mineral 1.5L")).toBeTruthy();
    expect(first.getByText(money(14.4, "USD"))).toBeTruthy();

    const second = within(cards[1] as HTMLElement);
    expect(second.getByText("Pan integral")).toBeTruthy();
    expect(second.getByText(money(7.5, "USD"))).toBeTruthy();
  });
});
