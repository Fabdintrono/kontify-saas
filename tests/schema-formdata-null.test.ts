import { describe, expect, it } from "vitest";
import { emitSchema } from "@/lib/ventas/schema";
import { paymentCreateSchema } from "@/lib/cobros/schema";

// FormData.get() devuelve null cuando el input no está en el formulario (p. ej. el método de pago
// solo se renderiza en contado y la fecha de vencimiento solo en crédito). Zod 4 rechaza null en
// .optional(), así que los campos opcionales deben tratar null como ausente.
describe("campos opcionales aceptan null (FormData.get de un input no renderizado)", () => {
  it("emitSchema contado sin dueDate", () => {
    const r = emitSchema.safeParse({ paymentType: "contado", paymentMethod: "Efectivo", dueDate: null });
    expect(r.success).toBe(true);
  });
  it("emitSchema crédito sin paymentMethod", () => {
    const r = emitSchema.safeParse({ paymentType: "credito", paymentMethod: null, dueDate: "2026-11-15" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.paymentMethod).toBeUndefined();
  });
  it("emitSchema sigue rechazando una fecha inválida", () => {
    expect(emitSchema.safeParse({ paymentType: "credito", paymentMethod: null, dueDate: "15/11/2026" }).success).toBe(false);
  });
  it("paymentCreateSchema con opcionales en null", () => {
    const r = paymentCreateSchema.safeParse({ saleId: "0c6d7c4e-1c7b-4b6e-9f0e-2b1c3d4e5f60", amount: "10", method: null, reference: null, paidAt: null, notes: null });
    expect(r.success).toBe(true);
  });
});
