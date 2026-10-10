// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { SaleBuilder } from "./sale-builder";

// El proyecto corre vitest sin `globals`, así que @testing-library no limpia solo.
afterEach(cleanup);

const branches = [{ id: "b1", name: "Casa Central", is_main: true }];
const line = { productId: "p1", description: "Tornillo", quantity: 2, unitPrice: 10, discountPct: 0, taxRate: 21 };

function renderBuilder() {
  return render(
    <SaleBuilder
      clients={[]}
      products={[]}
      branches={branches}
      role="owner"
      userBranchId="b1"
      currency="USD"
      values={{ items: [line] }}
    />,
  );
}

describe("SaleBuilder — líneas en el teléfono", () => {
  it("cada campo numérico de la línea tiene su rótulo", () => {
    renderBuilder();
    expect(screen.getByLabelText(/Cant\./)).toBeTruthy();
    expect(screen.getByLabelText(/Precio/)).toBeTruthy();
    expect(screen.getByLabelText(/Desc\. %/)).toBeTruthy();
    expect(screen.getByLabelText(/IVA/)).toBeTruthy();
  });
  it("el rótulo apunta al input de esa línea", () => {
    renderBuilder();
    const qty = screen.getByLabelText(/Cant\./) as HTMLInputElement;
    expect(qty.id).toBe("l0-qty");
    expect(qty.value).toBe("2");
    expect(qty.type).toBe("number");
  });
  it("la basura se nombra por la línea y el neto se rotula", () => {
    renderBuilder();
    const trash = screen.getByLabelText("Quitar Tornillo");
    expect(trash).toBeTruthy();
    // «Neto» rotula el total dentro de la tarjeta de la línea (la cabecera de
    // escritorio también lo dice, así que se busca dentro de la línea).
    expect(trash.closest("div.grid")?.textContent).toContain("Neto");
  });
});
