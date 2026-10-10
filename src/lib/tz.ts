// Helpers puros de zona horaria. Sin librerías: usa Intl, que trae la base de datos IANA de Node.
// Convención: "fecha local" = string "YYYY-MM-DD" en la zona de la empresa; "instante" = ISO UTC.

export type DateRange = { from: string; to: string };

const pad = (n: number) => String(n).padStart(2, "0");

function partsIn(instant: Date, tz: string) {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const get = (type: string) => Number(f.formatToParts(instant).find((p) => p.type === type)?.value);
  return { y: get("year"), m: get("month"), d: get("day"), h: get("hour"), mi: get("minute"), s: get("second") };
}

/** Desfase de la zona (minutos respecto a UTC) en un instante dado. Caracas → -240. */
export function tzOffsetMinutes(instant: Date, tz: string): number {
  const p = partsIn(instant, tz);
  const asUTC = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s);
  return Math.round((asUTC - instant.getTime()) / 60000);
}

/** "YYYY-MM-DD" del instante en la zona. */
export function localDateISO(instant: Date, tz: string): string {
  const p = partsIn(instant, tz);
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
}

/** Hoy en la zona. `now` es inyectable para tests. */
export function todayISO(tz: string, now: Date = new Date()): string {
  return localDateISO(now, tz);
}

/** Suma días a una fecha local sin pasar por la zona del proceso. */
export function addDaysISO(dateISO: string, n: number): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** Instante UTC (ISO) de la medianoche local de `dateISO` en la zona. Dos pasadas por si cruza un cambio de horario. */
export function startOfDayUTC(dateISO: string, tz: string): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d);
  let off = tzOffsetMinutes(new Date(guess), tz);
  let instant = guess - off * 60000;
  off = tzOffsetMinutes(new Date(instant), tz);
  instant = guess - off * 60000;
  return new Date(instant).toISOString();
}

/** Rango de días locales inclusivo → [fromInstant, toInstant) para filtrar columnas timestamptz. */
export function rangeToInstants(range: DateRange, tz: string): { fromInstant: string; toInstant: string } {
  return { fromInstant: startOfDayUTC(range.from, tz), toInstant: startOfDayUTC(addDaysISO(range.to, 1), tz) };
}
