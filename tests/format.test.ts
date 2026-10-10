import { describe, it, expect } from "vitest";
import { formatDate, formatDateOnly, weekdayShort } from "@/lib/format";

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
});
