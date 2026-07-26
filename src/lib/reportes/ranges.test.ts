import { describe, it, expect } from "vitest";
import { presetRange, monthRange, weekRange, addDays } from "./ranges";

// Miércoles 15 de julio de 2026 (Jul 1 2026 = miércoles → semana empieza lunes 13).
const ref = new Date(2026, 6, 15);

describe("reportes — ranges", () => {
  it("hoy", () => { expect(presetRange("hoy", ref)).toEqual({ from: "2026-07-15", to: "2026-07-15" }); });
  it("esta semana (lunes → hoy)", () => { expect(weekRange(ref)).toEqual({ from: "2026-07-13", to: "2026-07-15" }); });
  it("este mes (1 → hoy)", () => { expect(monthRange(ref)).toEqual({ from: "2026-07-01", to: "2026-07-15" }); });
  it("mes pasado (1 → último día)", () => { expect(presetRange("mes_pasado", ref)).toEqual({ from: "2026-06-01", to: "2026-06-30" }); });
  it("addDays cruza fin de mes", () => { expect(addDays("2026-07-31", 1)).toBe("2026-08-01"); });
});
