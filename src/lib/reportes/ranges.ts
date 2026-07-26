export type DateRange = { from: string; to: string };
export type Preset = "hoy" | "semana" | "mes" | "mes_pasado";

const fmt = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return fmt(new Date(y, m - 1, d + n));
}

export function presetRange(preset: Preset, ref: Date): DateRange {
  const y = ref.getFullYear(), m = ref.getMonth(), day = ref.getDate();
  switch (preset) {
    case "hoy": { const t = fmt(ref); return { from: t, to: t }; }
    case "semana": {
      const dow = (ref.getDay() + 6) % 7; // 0 = lunes
      return { from: fmt(new Date(y, m, day - dow)), to: fmt(ref) };
    }
    case "mes": return { from: fmt(new Date(y, m, 1)), to: fmt(ref) };
    case "mes_pasado": return { from: fmt(new Date(y, m - 1, 1)), to: fmt(new Date(y, m, 0)) };
  }
}

export const monthRange = (ref: Date): DateRange => presetRange("mes", ref);
export const weekRange = (ref: Date): DateRange => presetRange("semana", ref);
