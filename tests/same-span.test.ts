import { describe, it, expect } from "vitest";
import { sameSpanLastMonth } from "@/lib/reportes/ranges";

describe("sameSpanLastMonth", () => {
  it("compara el mismo tramo, no el mes entero", () => {
    expect(sameSpanLastMonth("2026-10-10")).toEqual({ from: "2026-09-01", to: "2026-09-10" });
  });

  it("cruza el año hacia atrás", () => {
    expect(sameSpanLastMonth("2026-01-07")).toEqual({ from: "2025-12-01", to: "2025-12-07" });
  });

  it("recorta cuando el día no existe en el mes anterior", () => {
    expect(sameSpanLastMonth("2026-03-31")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(sameSpanLastMonth("2024-03-30")).toEqual({ from: "2024-02-01", to: "2024-02-29" }); // bisiesto
  });

  it("el día 1 compara contra el día 1", () => {
    expect(sameSpanLastMonth("2026-05-01")).toEqual({ from: "2026-04-01", to: "2026-04-01" });
  });

  it("rechaza una fecha inválida en vez de inventar un rango", () => {
    expect(() => sameSpanLastMonth("ayer")).toThrow();
  });
});
