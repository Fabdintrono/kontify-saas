import { describe, it, expect } from "vitest";
import { localDateISO, startOfDayUTC, addDaysISO, rangeToInstants, todayISO, isDateISO, tzOffsetMinutes } from "@/lib/tz";

const VE = "America/Caracas"; // UTC-4 todo el año

describe("tz helpers", () => {
  it("localDateISO: 03:56Z del 10/10 es todavía el 9/10 en Venezuela", () => {
    expect(localDateISO(new Date("2026-10-10T03:56:01Z"), VE)).toBe("2026-10-09");
    expect(localDateISO(new Date("2026-10-10T04:00:00Z"), VE)).toBe("2026-10-10");
    expect(localDateISO(new Date("2026-10-10T03:56:01Z"), "UTC")).toBe("2026-10-10");
  });
  it("startOfDayUTC: medianoche local → instante UTC", () => {
    expect(startOfDayUTC("2026-10-09", VE)).toBe("2026-10-09T04:00:00.000Z");
    expect(startOfDayUTC("2026-10-09", "UTC")).toBe("2026-10-09T00:00:00.000Z");
    expect(startOfDayUTC("2026-01-01", "Asia/Tokyo")).toBe("2025-12-31T15:00:00.000Z");
  });
  it("startOfDayUTC respeta el cambio de horario (Nueva York, 8 de marzo 2026)", () => {
    expect(startOfDayUTC("2026-03-08", "America/New_York")).toBe("2026-03-08T05:00:00.000Z"); // EST
    expect(startOfDayUTC("2026-03-09", "America/New_York")).toBe("2026-03-09T04:00:00.000Z"); // EDT
  });
  it("addDaysISO suma días sin depender de la zona del proceso", () => {
    expect(addDaysISO("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDaysISO("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("rangeToInstants: [from, to] en días locales → [fromInstant, toInstant) en UTC", () => {
    expect(rangeToInstants({ from: "2026-10-09", to: "2026-10-09" }, VE))
      .toEqual({ fromInstant: "2026-10-09T04:00:00.000Z", toInstant: "2026-10-10T04:00:00.000Z" });
  });
  it("todayISO usa la zona", () => {
    expect(todayISO(VE, new Date("2026-10-10T03:56:01Z"))).toBe("2026-10-09");
  });
  it("startOfDayUTC: si la medianoche local no existe, el día arranca en la transición", () => {
    expect(startOfDayUTC("2026-03-08", "America/Havana")).toBe("2026-03-08T05:00:00.000Z");
    expect(startOfDayUTC("2026-09-06", "America/Santiago")).toBe("2026-09-06T04:00:00.000Z");
    expect(startOfDayUTC("2026-03-29", "Atlantic/Azores")).toBe("2026-03-29T01:00:00.000Z");
  });
  it("startOfDayUTC: si la medianoche local ocurre dos veces, toma la primera", () => {
    expect(startOfDayUTC("2026-11-01", "America/Havana")).toBe("2026-11-01T04:00:00.000Z");
  });
  it("tzOffsetMinutes: zonas con desfase no entero", () => {
    const t = new Date("2026-06-15T00:00:00Z");
    expect(tzOffsetMinutes(t, "Asia/Kathmandu")).toBe(345);
    expect(tzOffsetMinutes(t, "Pacific/Kiritimati")).toBe(840);
    expect(tzOffsetMinutes(t, "Etc/GMT+12")).toBe(-720);
  });
  it("rangeToInstants: cruza el cambio de horario sin perder ni duplicar horas; invertido se normaliza", () => {
    expect(rangeToInstants({ from: "2026-03-07", to: "2026-03-09" }, "America/New_York"))
      .toEqual({ fromInstant: "2026-03-07T05:00:00.000Z", toInstant: "2026-03-10T04:00:00.000Z" });
    expect(rangeToInstants({ from: "2026-10-20", to: "2026-10-01" }, "UTC"))
      .toEqual({ fromInstant: "2026-10-01T00:00:00.000Z", toInstant: "2026-10-21T00:00:00.000Z" });
  });
  it("isDateISO y las guardas de entrada", () => {
    expect(isDateISO("2026-10-09")).toBe(true);
    expect(isDateISO("2026-02-30")).toBe(false);
    expect(isDateISO("2026-10-09T00:00:00Z")).toBe(false);
    expect(isDateISO("basura")).toBe(false);
    expect(isDateISO(null)).toBe(false);
    expect(() => addDaysISO("basura", 1)).toThrow(/Fecha local inválida/);
    expect(() => startOfDayUTC("2026-13-45", "UTC")).toThrow(/Fecha local inválida/);
    expect(() => localDateISO(new Date(), "Mars/Phobos")).toThrow(RangeError);
    expect(isDateISO("0099-01-01")).toBe(false);
    expect(isDateISO("1000-01-01")).toBe(true);
    expect(() => addDaysISO("2026-10-09", NaN)).toThrow(/Desplazamiento de días inválido/);
    expect(() => addDaysISO("2026-10-09", 0.5)).toThrow(/Desplazamiento de días inválido/);
    expect(() => rangeToInstants({ from: "2026-10-20", to: "basura" }, "UTC")).toThrow(/basura/);
  });
  it("todayISO sin now usa el reloj y devuelve YYYY-MM-DD", () => {
    expect(todayISO("UTC")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
