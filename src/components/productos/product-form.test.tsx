// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { ProductForm } from "./product-form";

afterEach(cleanup);

function renderForm(values = {}) {
  return render(
    <ProductForm action={async () => ({ ok: false })} categories={[]} taxRates={[]} currency="USD"
      submitLabel="Crear producto" cancelHref="/operaciones/productos" values={values} />,
  );
}

describe("ProductForm", () => {
  it("cada campo visible tiene su etiqueta asociada", () => {
    renderForm();
    for (const label of ["Tipo", "Nombre *", "SKU o código", "Unidad", "Categoría",
      "Descripción", "Precio de venta *", "Costo", "Impuesto", "Stock mínimo"]) {
      expect(screen.getByLabelText(label), label).toBeTruthy();
    }
  });

  it("el margen se calcula mientras se escribe", () => {
    renderForm();
    fireEvent.change(screen.getByLabelText("Precio de venta *"), { target: { value: "100" } });
    fireEvent.change(screen.getByLabelText("Costo"), { target: { value: "60" } });
    expect(screen.getByRole("status").textContent).toContain("40%");
    expect(screen.getByRole("status").textContent).toContain("USD 40.00");
  });

  it("sin costo no inventa un margen", () => {
    renderForm();
    fireEvent.change(screen.getByLabelText("Precio de venta *"), { target: { value: "100" } });
    expect(screen.getByRole("status").textContent).toBe("Escribe precio y costo para ver el margen.");
  });

  it("un costo mayor que el precio da margen negativo, no lo esconde", () => {
    renderForm();
    fireEvent.change(screen.getByLabelText("Precio de venta *"), { target: { value: "50" } });
    fireEvent.change(screen.getByLabelText("Costo"), { target: { value: "80" } });
    expect(screen.getByRole("status").textContent).toContain("-60%");
  });

  it("un servicio esconde el bloque de inventario pero sigue enviando el mínimo", () => {
    const { container } = renderForm();
    expect(screen.getByRole("heading", { name: "Inventario" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Tipo"), { target: { value: "service" } });
    expect(screen.queryByRole("heading", { name: "Inventario" })).toBeNull();
    expect(container.querySelector('input[type="hidden"][name="minStock"]')).toBeTruthy();
  });

  it("ofrece siempre una salida sin guardar", () => {
    renderForm();
    expect(screen.getByRole("link", { name: "Cancelar" }).getAttribute("href")).toBe("/operaciones/productos");
  });
});
