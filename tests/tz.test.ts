import { describe, it, expect } from "vitest";
import { localDateISO, startOfDayUTC, addDaysISO, rangeToInstants, todayISO } from "@/lib/tz";

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
});
