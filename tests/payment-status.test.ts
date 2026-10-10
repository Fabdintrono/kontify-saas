import { describe, it, expect } from "vitest";
import { paymentStatusOf } from "@/lib/cobros/status";

const HOY = "2026-10-09";
describe("paymentStatusOf", () => {
  it("borrador y anulada no tienen estado de pago", () => {
    expect(paymentStatusOf({ status: "draft", total: 10, paidAmount: 0, dueDate: null }, HOY)).toBeNull();
    expect(paymentStatusOf({ status: "void", total: 10, paidAmount: 0, dueDate: null }, HOY)).toBeNull();
  });
  it("pagada cuando el saldo es cero (o negativo por redondeo)", () => {
    expect(paymentStatusOf({ status: "issued", total: 25.4, paidAmount: 25.4, dueDate: null }, HOY)).toBe("pagada");
    expect(paymentStatusOf({ status: "issued", total: 10, paidAmount: 10.004, dueDate: "2026-01-01" }, HOY)).toBe("pagada");
  });
  it("parcial cuando hay abonos pero queda saldo", () => {
    expect(paymentStatusOf({ status: "issued", total: 10, paidAmount: 4, dueDate: null }, HOY)).toBe("parcial");
  });
  it("vencida gana a parcial/pendiente si due_date < hoy y hay saldo", () => {
    expect(paymentStatusOf({ status: "issued", total: 10, paidAmount: 4, dueDate: "2026-10-01" }, HOY)).toBe("vencida");
    expect(paymentStatusOf({ status: "issued", total: 10, paidAmount: 0, dueDate: "2026-10-08" }, HOY)).toBe("vencida");
    expect(paymentStatusOf({ status: "issued", total: 10, paidAmount: 0, dueDate: "2026-10-09" }, HOY)).toBe("pendiente"); // vence hoy: aún no
  });
  it("pendiente sin abonos y sin vencer", () => {
    expect(paymentStatusOf({ status: "issued", total: 10, paidAmount: 0, dueDate: null }, HOY)).toBe("pendiente");
    expect(paymentStatusOf({ status: "issued", total: 10, paidAmount: 0, dueDate: "2026-11-15" }, HOY)).toBe("pendiente");
  });
});
