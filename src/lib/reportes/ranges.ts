import { addDaysISO, localDateISO, assertDateISO, type DateRange } from "@/lib/tz";

export type { DateRange };
export type Preset = "hoy" | "semana" | "mes" | "mes_pasado";

/** Mantiene el nombre anterior; ahora valida la entrada y lanza ante basura (ver tz.ts). */
export const addDays = addDaysISO;

const startOfMonth = (dateISO: string) => `${dateISO.slice(0, 7)}-01`;
/** 0 = lunes … 6 = domingo, leído de la fecha local (no de la zona del proceso). */
const mondayIndex = (dateISO: string) => (new Date(`${dateISO}T00:00:00Z`).getUTCDay() + 6) % 7;

/** Preset → rango a partir de un día local ya calculado ("YYYY-MM-DD"). */
export function presetRangeFor(preset: Preset, today: string): DateRange {
  assertDateISO(today);
  switch (preset) {
    case "hoy": return { from: today, to: today };
    case "semana": return { from: addDaysISO(today, -mondayIndex(today)), to: today };
    case "mes": return { from: startOfMonth(today), to: today };
    case "mes_pasado": {
      const to = addDaysISO(startOfMonth(today), -1);
      return { from: startOfMonth(to), to };
    }
  }
}

/** Preset → rango de días locales en la zona `tz`, tomando `ref` como "ahora". */
export function presetRange(preset: Preset, ref: Date, tz: string): DateRange {
  return presetRangeFor(preset, localDateISO(ref, tz));
}

export const PRESET_KEYS = ["hoy", "semana", "mes", "mes_pasado"] as const satisfies readonly Preset[];
// Si falta un Preset en PRESET_KEYS, esta línea deja de compilar.
type _AllPresetsListed = Exclude<Preset, (typeof PRESET_KEYS)[number]> extends never ? true : never;
const _allPresetsListed: _AllPresetsListed = true;

/** Qué preset coincide exactamente con un rango (el más estrecho gana en empates: hoy > semana > mes). */
export function activePreset(today: string, r: DateRange): Preset | undefined {
  return PRESET_KEYS.find((p) => { const x = presetRangeFor(p, today); return x.from === r.from && x.to === r.to; });
}

export const monthRange = (ref: Date, tz: string): DateRange => presetRange("mes", ref, tz);
export const weekRange = (ref: Date, tz: string): DateRange => presetRange("semana", ref, tz);
