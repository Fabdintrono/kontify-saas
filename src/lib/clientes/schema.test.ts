import { describe, it, expect } from "vitest";
import { clientCreateSchema, clientTypeCreateSchema } from "@/lib/clientes/schema";

describe("clientCreateSchema", () => {
  it("acepta un cliente válido y normaliza vacíos a undefined", () => {
    const r = clientCreateSchema.safeParse({ kind: "person", name: "Juan", email: "", phone: "0412" });
    expect(r.success).toBe(true);
    if (r.success) { expect(r.data.email).toBeUndefined(); expect(r.data.phone).toBe("0412"); }
  });
  it("exige name no vacío", () => {
    expect(clientCreateSchema.safeParse({ kind: "person", name: "" }).success).toBe(false);
  });
  it("rechaza kind inválido", () => {
    expect(clientCreateSchema.safeParse({ kind: "robot", name: "X" }).success).toBe(false);
  });
  it("rechaza email inválido si viene", () => {
    expect(clientCreateSchema.safeParse({ kind: "person", name: "X", email: "no-mail" }).success).toBe(false);
  });
});

describe("clientTypeCreateSchema", () => {
  it("exige name", () => {
    expect(clientTypeCreateSchema.safeParse({ name: "" }).success).toBe(false);
    expect(clientTypeCreateSchema.safeParse({ name: "VIP" }).success).toBe(true);
  });
});
