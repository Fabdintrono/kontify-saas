import { describe, it, expect } from "vitest";
import { presetRange, monthRange, weekRange, addDays } from "@/lib/reportes/ranges";

const VE = "America/Caracas";
// Viernes 9 de octubre de 2026 a las 23:56 en Venezuela (= 10/10 03:56Z)
const REF = new Date("2026-10-10T03:56:01Z");

describe("presetRange con zona horaria", () => {
  it("hoy", () => expect(presetRange("hoy", REF, VE)).toEqual({ from: "2026-10-09", to: "2026-10-09" }));
  it("semana (lunes a hoy)", () => expect(presetRange("semana", REF, VE)).toEqual({ from: "2026-10-05", to: "2026-10-09" }));
  it("mes", () => expect(presetRange("mes", REF, VE)).toEqual({ from: "2026-10-01", to: "2026-10-09" }));
  it("mes pasado", () => expect(presetRange("mes_pasado", REF, VE)).toEqual({ from: "2026-09-01", to: "2026-09-30" }));
  it("en UTC el mismo instante ya es 10/10", () => expect(presetRange("hoy", REF, "UTC")).toEqual({ from: "2026-10-10", to: "2026-10-10" }));
  it("wrappers", () => {
    expect(monthRange(REF, VE)).toEqual({ from: "2026-10-01", to: "2026-10-09" });
    expect(weekRange(REF, VE)).toEqual({ from: "2026-10-05", to: "2026-10-09" });
  });
  it("addDays sigue exportado", () => expect(addDays("2026-10-09", 1)).toBe("2026-10-10"));
});
