import { describe, it, expect } from "vitest";
import { siguienteFecha, diasHasta, estadoVencimiento, textoVencimiento } from "@/lib/gastos/schedule";

describe("siguienteFecha", () => {
  it("semanal suma siete días y quincenal quince", () => {
    expect(siguienteFecha("2026-10-10", "semanal")).toBe("2026-10-17");
    expect(siguienteFecha("2026-10-10", "quincenal")).toBe("2026-10-25");
  });

  it("mensual conserva el día", () => {
    expect(siguienteFecha("2026-10-05", "mensual", 5)).toBe("2026-11-05");
  });

  it("mensual cruza el año", () => {
    expect(siguienteFecha("2026-12-20", "mensual", 20)).toBe("2027-01-20");
  });

  it("bimestral, trimestral y anual saltan lo suyo", () => {
    expect(siguienteFecha("2026-01-15", "bimestral", 15)).toBe("2026-03-15");
    expect(siguienteFecha("2026-01-15", "trimestral", 15)).toBe("2026-04-15");
    expect(siguienteFecha("2026-01-15", "anual", 15)).toBe("2027-01-15");
  });

  it("recorta al último día cuando el mes destino es más corto", () => {
    expect(siguienteFecha("2026-01-31", "mensual", 31)).toBe("2026-02-28");
    expect(siguienteFecha("2026-03-31", "mensual", 31)).toBe("2026-04-30");
  });

  it("el año bisiesto da 29 de febrero", () => {
    expect(siguienteFecha("2024-01-31", "mensual", 31)).toBe("2024-02-29");
  });

  it("después de recortar vuelve al día original: no se queda pegado", () => {
    // Un alquiler del 31 pasa por febrero y tiene que volver al 31 en marzo.
    const feb = siguienteFecha("2026-01-31", "mensual", 31);
    expect(feb).toBe("2026-02-28");
    expect(siguienteFecha(feb, "mensual", 31)).toBe("2026-03-31");
  });

  it("la quincena del 30 sobrevive a febrero", () => {
    const feb = siguienteFecha("2026-01-30", "mensual", 30);
    expect(feb).toBe("2026-02-28");
    expect(siguienteFecha(feb, "mensual", 30)).toBe("2026-03-30");
  });

  it("sin ancla usa el día de la fecha de partida", () => {
    expect(siguienteFecha("2026-01-15", "mensual")).toBe("2026-02-15");
  });

  it("anual desde el 29 de febrero de un bisiesto cae en el 28", () => {
    expect(siguienteFecha("2024-02-29", "anual", 29)).toBe("2025-02-28");
  });

  it("rechaza una fecha inválida en vez de inventar una", () => {
    expect(() => siguienteFecha("mañana", "mensual")).toThrow();
  });
});

describe("diasHasta", () => {
  it("cuenta hacia adelante y hacia atrás", () => {
    expect(diasHasta("2026-10-15", "2026-10-10")).toBe(5);
    expect(diasHasta("2026-10-05", "2026-10-10")).toBe(-5);
    expect(diasHasta("2026-10-10", "2026-10-10")).toBe(0);
  });

  it("cruza meses y años sin desviarse", () => {
    expect(diasHasta("2026-11-01", "2026-10-31")).toBe(1);
    expect(diasHasta("2027-01-01", "2026-12-31")).toBe(1);
    expect(diasHasta("2024-03-01", "2024-02-28")).toBe(2);   // bisiesto
  });
});

describe("estadoVencimiento", () => {
  it("separa vencido, hoy, próximo y lejano", () => {
    expect(estadoVencimiento("2026-10-09", "2026-10-10")).toBe("vencido");
    expect(estadoVencimiento("2026-10-10", "2026-10-10")).toBe("hoy");
    expect(estadoVencimiento("2026-10-17", "2026-10-10")).toBe("proximo");
    expect(estadoVencimiento("2026-10-18", "2026-10-10")).toBe("lejano");
  });
});

describe("textoVencimiento", () => {
  it("habla como una persona", () => {
    expect(textoVencimiento("2026-10-10", "2026-10-10")).toBe("vence hoy");
    expect(textoVencimiento("2026-10-11", "2026-10-10")).toBe("vence mañana");
    expect(textoVencimiento("2026-10-09", "2026-10-10")).toBe("venció ayer");
    expect(textoVencimiento("2026-10-07", "2026-10-10")).toBe("venció hace 3 días");
    expect(textoVencimiento("2026-10-15", "2026-10-10")).toBe("en 5 días");
  });
});
