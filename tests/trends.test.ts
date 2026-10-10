import { describe, it, expect } from "vitest";
import { variacion } from "@/lib/dashboard/trends";

describe("variacion", () => {
  it("calcula la subida con un decimal", () => {
    expect(variacion(120, 100)).toEqual({ pct: 20, previo: 100 });
    expect(variacion(133, 100)).toEqual({ pct: 33, previo: 100 });
    expect(variacion(100.5, 97)).toEqual({ pct: 3.6, previo: 97 });
  });

  it("calcula la bajada en negativo", () => {
    expect(variacion(60, 100)).toEqual({ pct: -40, previo: 100 });
  });

  it("sin base previa no inventa un porcentaje", () => {
    expect(variacion(500, 0)).toEqual({ pct: null, previo: 0, motivo: "sin-base" });
  });

  it("distingue «no hubo nada antes ni ahora» de «empezamos de cero»", () => {
    expect(variacion(0, 0).motivo).toBe("sin-datos");
    expect(variacion(10, 0).motivo).toBe("sin-base");
  });

  it("sin cambio da cero, no null", () => {
    expect(variacion(100, 100)).toEqual({ pct: 0, previo: 100 });
  });
});
