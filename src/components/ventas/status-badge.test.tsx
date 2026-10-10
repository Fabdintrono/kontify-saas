// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { SaleStatusBadge } from "./status-badge";

// El proyecto corre vitest sin `globals`, así que @testing-library no limpia solo
// y el DOM de un test se vería en el siguiente (este archivo asegura ausencias).
afterEach(cleanup);

describe("SaleStatusBadge", () => {
  it("emitida sin estado de pago muestra Emitida", () => {
    render(<SaleStatusBadge status="issued" />);
    expect(screen.getByText("Emitida")).toBeTruthy();
  });
  it("emitida con estado de pago muestra el estado de pago", () => {
    render(<SaleStatusBadge status="issued" paymentStatus="vencida" />);
    expect(screen.getByText("Vencida")).toBeTruthy();
    expect(screen.queryByText("Emitida")).toBeNull();
  });
  it("borrador y anulada ignoran paymentStatus", () => {
    render(<SaleStatusBadge status="void" paymentStatus="pagada" />);
    expect(screen.getByText("Anulada")).toBeTruthy();
  });
  it("lleva icono (no depende solo del color)", () => {
    const { container } = render(<SaleStatusBadge status="issued" paymentStatus="pagada" />);
    expect(container.querySelector("svg")).not.toBeNull();
  });
});
