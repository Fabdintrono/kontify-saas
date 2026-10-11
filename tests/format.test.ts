import { describe, it, expect } from "vitest";
import { formatMoney, formatDate, formatDateOnly, weekdayShort } from "@/lib/format";

describe("fechas", () => {
  it("formatDate muestra un timestamptz en la zona de la empresa (dd/mm/aaaa)", () => {
    expect(formatDate("2026-10-10T03:56:01+00:00", "America/Caracas")).toBe("09/10/2026");
    expect(formatDate("2026-10-10T03:56:01+00:00", "UTC")).toBe("10/10/2026");
    expect(formatDate(null, "UTC")).toBe("—");
  });
  it("formatDateOnly no pasa una columna DATE por new Date() (que la corría un día)", () => {
    expect(formatDateOnly("2026-10-01")).toBe("01/10/2026");
    expect(formatDateOnly(null)).toBe("—");
  });
  it("weekdayShort etiqueta un día local", () => {
    expect(weekdayShort("2026-10-09")).toBe("vie");
    expect(weekdayShort("2026-10-10")).toBe("sáb");
  });
  it("formatDate: el borde de medianoche en Caracas cae del lado correcto", () => {
    expect(formatDate("2026-10-10T03:59:59Z", "America/Caracas")).toBe("09/10/2026");
    expect(formatDate("2026-10-10T04:00:00Z", "America/Caracas")).toBe("10/10/2026");
  });
  it("formatDate: una columna DATE pasada por error no se corre un día", () => {
    expect(formatDate("2026-10-01", "America/Caracas")).toBe("01/10/2026");
  });
  it("formatDate nunca lanza: zona inválida o vacía usa la de respaldo; basura → —", () => {
    expect(formatDate("2026-10-10T03:56:01Z", "Nowhere/Fake")).toBe("09/10/2026");
    expect(formatDate("2026-10-10T03:56:01Z", "")).toBe("09/10/2026");
    expect(formatDate("basura", "UTC")).toBe("—");
    expect(formatDate(undefined, "UTC")).toBe("—");
  });
  it("formatDateOnly rechaza instantes completos y fechas inválidas", () => {
    expect(formatDateOnly("2026-10-10T03:56:01+00:00")).toBe("—");
    expect(formatDateOnly("2026-13-45")).toBe("—");
    expect(formatDateOnly("2026-1-5")).toBe("—");
    expect(formatDateOnly("")).toBe("—");
  });
  it("weekdayShort degrada a — en vez de lanzar", () => {
    expect(weekdayShort("basura")).toBe("—");
    expect(weekdayShort(null)).toBe("—");
    expect(weekdayShort("2026-10-12")).toBe("lun");
  });
});

describe("formatMoney — negativos", () => {
  // `Intl` separa la moneda del número con un espacio duro; se normaliza para que la
  // prueba hable de lo que importa y no de qué espacio usa la librería.
  const m = (n: number) => formatMoney(n, "USD").replace(/\u00a0/g, " ");

  it("pone el signo delante, separado de la moneda", () => {
    expect(m(-587.5)).toBe("-USD 587,50");
  });

  it("el positivo no cambia", () => {
    expect(m(587.5)).toBe("USD 587,50");
  });

  it("el cero no lleva signo", () => {
    expect(m(0)).toBe("USD 0,00");
    expect(m(-0)).toBe("USD 0,00");
  });

  it("el signo nunca queda pegado a la moneda", () => {
    expect(m(-1234.56)).not.toContain("USD-");
  });
});
