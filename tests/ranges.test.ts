import { describe, it, expect } from "vitest";
import { presetRange, presetRangeFor, activePreset, monthRange, weekRange, addDays } from "@/lib/reportes/ranges";

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
  it("semana: lunes se queda en sí mismo y domingo retrocede seis días", () => {
    expect(presetRange("semana", new Date("2026-10-05T12:00:00Z"), "UTC")).toEqual({ from: "2026-10-05", to: "2026-10-05" });
    expect(presetRange("semana", new Date("2026-10-11T12:00:00Z"), "UTC")).toEqual({ from: "2026-10-05", to: "2026-10-11" });
  });
  it("semana cruza el año: jueves 1 de enero arranca el lunes 29 de diciembre", () => {
    expect(presetRange("semana", new Date("2026-01-01T12:00:00Z"), "UTC")).toEqual({ from: "2025-12-29", to: "2026-01-01" });
  });
  it("mes pasado desde enero es diciembre del año anterior", () => {
    expect(presetRange("mes_pasado", new Date("2026-01-15T12:00:00Z"), "UTC")).toEqual({ from: "2025-12-01", to: "2025-12-31" });
  });
  it("mes pasado desde marzo respeta febrero bisiesto y no bisiesto", () => {
    expect(presetRange("mes_pasado", new Date("2028-03-10T12:00:00Z"), "UTC")).toEqual({ from: "2028-02-01", to: "2028-02-29" });
    expect(presetRange("mes_pasado", new Date("2027-03-10T12:00:00Z"), "UTC")).toEqual({ from: "2027-02-01", to: "2027-02-28" });
  });
  it("a las 23:00 del domingo en Caracas la semana sigue siendo la que termina ese domingo", () => {
    expect(presetRange("semana", new Date("2026-10-12T03:00:00Z"), "America/Caracas")).toEqual({ from: "2026-10-05", to: "2026-10-11" });
  });
  it("presetRangeFor y activePreset: el preset más estrecho gana en empates", () => {
    expect(presetRangeFor("mes", "2026-10-09")).toEqual({ from: "2026-10-01", to: "2026-10-09" });
    expect(activePreset("2026-10-09", { from: "2026-10-05", to: "2026-10-09" })).toBe("semana");
    expect(activePreset("2026-10-01", { from: "2026-10-01", to: "2026-10-01" })).toBe("hoy"); // 1.º del mes: hoy == mes
    expect(activePreset("2026-10-09", { from: "2026-09-01", to: "2026-09-30" })).toBe("mes_pasado");
    expect(activePreset("2026-10-09", { from: "2026-10-02", to: "2026-10-09" })).toBeUndefined();
  });
  it("presetRangeFor lanza si 'today' no es una fecha local válida", () => {
    expect(() => presetRangeFor("hoy", "basura")).toThrow(/Fecha local inválida/);
  });
});
