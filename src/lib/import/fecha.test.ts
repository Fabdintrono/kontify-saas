import { describe, it, expect } from "vitest";
import { parseFecha } from "@/lib/import/fecha";

describe("parseFecha", () => {
  it("lee la forma de aquí: día primero", () => {
    expect(parseFecha("05/10/2026")).toBe("2026-10-05");
    expect(parseFecha("5/10/2026")).toBe("2026-10-05");
    expect(parseFecha("31/12/2026")).toBe("2026-12-31");
  });

  it("acepta guion y punto como separador", () => {
    expect(parseFecha("05-10-2026")).toBe("2026-10-05");
    expect(parseFecha("05.10.2026")).toBe("2026-10-05");
  });

  it("acepta la que ya viene normalizada", () => {
    expect(parseFecha("2026-10-05")).toBe("2026-10-05");
    expect(parseFecha("2026-1-5")).toBe("2026-01-05");
  });

  it("completa el año de dos cifras por el lado razonable", () => {
    expect(parseFecha("05/10/26")).toBe("2026-10-05");
    expect(parseFecha("05/10/99")).toBe("1999-10-05");
    expect(parseFecha("05/10/69")).toBe("2069-10-05");
    expect(parseFecha("05/10/70")).toBe("1970-10-05");
  });

  it("endereza la fecha que viene al revés cuando es inequívoco", () => {
    // 10/25/2026 solo puede ser mes/día: no hay día 25 de mes.
    expect(parseFecha("10/25/2026")).toBe("2026-10-25");
  });

  it("con las dos cifras por debajo de 13 manda la forma de aquí", () => {
    expect(parseFecha("03/04/2026")).toBe("2026-04-03");
  });

  it("lee el número de serie de Excel", () => {
    // 1 de enero de 2026 es la serie 46023.
    expect(parseFecha("46023")).toBe("2026-01-01");
    expect(parseFecha("1")).toBe("1899-12-31");
  });

  it("ignora la parte de hora del número de serie", () => {
    expect(parseFecha("46023.75")).toBe("2026-01-01");
  });

  it("rechaza un día que no existe", () => {
    expect(parseFecha("31/02/2026")).toBeNull();
    expect(parseFecha("30/02/2024")).toBeNull();
    expect(parseFecha("2026-13-01")).toBeNull();
  });

  it("acepta el 29 de febrero de un bisiesto", () => {
    expect(parseFecha("29/02/2024")).toBe("2024-02-29");
    expect(parseFecha("29/02/2026")).toBeNull();
  });

  it("rechaza un número que no puede ser una fecha", () => {
    expect(parseFecha("999999")).toBeNull();
    expect(parseFecha("0")).toBeNull();
  });

  it("rechaza texto", () => {
    expect(parseFecha("ayer")).toBeNull();
    expect(parseFecha("5 de octubre")).toBeNull();
    expect(parseFecha("")).toBeNull();
  });
});
