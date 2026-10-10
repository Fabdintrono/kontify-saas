import { addDaysISO, localDateISO } from "@/lib/tz";
import type { DateRange } from "@/lib/tz";

export type { DateRange };
export type Preset = "hoy" | "semana" | "mes" | "mes_pasado";

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m0: number, d: number) => {
  const t = new Date(Date.UTC(y, m0, d));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
};

/** Mantiene la firma anterior; delega en el helper puro. */
export const addDays = addDaysISO;

/** Preset → rango de días locales en la zona `tz`, tomando `ref` como "ahora". */
export function presetRange(preset: Preset, ref: Date, tz: string): DateRange {
  const today = localDateISO(ref, tz);
  const [y, m, d] = today.split("-").map(Number);
  switch (preset) {
    case "hoy": return { from: today, to: today };
    case "semana": {
      const dow = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7; // 0 = lunes
      return { from: iso(y, m - 1, d - dow), to: today };
    }
    case "mes": return { from: iso(y, m - 1, 1), to: today };
    case "mes_pasado": return { from: iso(y, m - 2, 1), to: iso(y, m - 1, 0) };
  }
}

export const monthRange = (ref: Date, tz: string): DateRange => presetRange("mes", ref, tz);
export const weekRange = (ref: Date, tz: string): DateRange => presetRange("semana", ref, tz);
