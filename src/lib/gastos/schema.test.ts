import { describe, it, expect } from "vitest";
import { expenseCreateSchema, recurringCreateSchema } from "@/lib/gastos/schema";

const base = { description: "Alquiler", spentOn: "2026-10-05" };

describe("expenseCreateSchema — el monto como lo escribe la gente", () => {
  it("acepta la coma decimal, que es como se escribe aquí", () => {
    expect(expenseCreateSchema.parse({ ...base, amount: "65,50" }).amount).toBe(65.5);
  });

  it("acepta el punto decimal", () => {
    expect(expenseCreateSchema.parse({ ...base, amount: "65.50" }).amount).toBe(65.5);
  });

  it("acepta el separador de miles", () => {
    expect(expenseCreateSchema.parse({ ...base, amount: "1.234,56" }).amount).toBe(1234.56);
    expect(expenseCreateSchema.parse({ ...base, amount: "1.500" }).amount).toBe(1500);
  });

  it("acepta espacios y el símbolo de moneda que a veces se pega", () => {
    expect(expenseCreateSchema.parse({ ...base, amount: " $300 " }).amount).toBe(300);
  });

  it("rechaza el cero: un gasto de cero es un error de carga", () => {
    const r = expenseCreateSchema.safeParse({ ...base, amount: "0" });
    expect(r.success).toBe(false);
    expect(r.error!.issues[0].message).toBe("El monto debe ser mayor que cero");
  });

  it("rechaza el negativo", () => {
    expect(expenseCreateSchema.safeParse({ ...base, amount: "-5" }).success).toBe(false);
  });

  it("explica con un ejemplo cuando no es un número", () => {
    const r = expenseCreateSchema.safeParse({ ...base, amount: "trescientos" });
    expect(r.success).toBe(false);
    expect(r.error!.issues[0].message).toContain("65,50");
  });

  it("exige decir en qué se gastó", () => {
    const r = expenseCreateSchema.safeParse({ ...base, description: "  ", amount: "10" });
    expect(r.error!.issues[0].message).toBe("Di en qué se gastó");
  });

  it("exige una fecha válida", () => {
    expect(expenseCreateSchema.safeParse({ ...base, spentOn: "05/10/2026", amount: "10" }).success).toBe(false);
  });

  it("los campos opcionales vacíos no estorban", () => {
    const r = expenseCreateSchema.parse({ ...base, amount: "10", categoryId: "", paymentMethod: "", notes: "" });
    expect(r.categoryId).toBeNull();
    expect(r.paymentMethod).toBeUndefined();
  });
});

describe("recurringCreateSchema", () => {
  const fijo = { description: "Internet", amount: "35", nextDue: "2026-10-08" };

  it("acepta una frecuencia conocida", () => {
    expect(recurringCreateSchema.parse({ ...fijo, frequency: "mensual" }).frequency).toBe("mensual");
  });

  it("rechaza una frecuencia inventada", () => {
    const r = recurringCreateSchema.safeParse({ ...fijo, frequency: "cuando sea" });
    expect(r.success).toBe(false);
    expect(r.error!.issues[0].message).toBe("Elige cada cuánto se paga");
  });

  it("el monto también admite coma", () => {
    expect(recurringCreateSchema.parse({ ...fijo, amount: "35,90", frequency: "mensual" }).amount).toBe(35.9);
  });
});
