// Helpers puros de zona horaria. Sin librerías: usa Intl, que trae la base de datos IANA de Node.
// Contrato:
//  - "fecha local" = string estricto "YYYY-MM-DD" en la zona de la empresa; "instante" = ISO UTC.
//  - `tz` debe ser una zona IANA válida (ya validada por getTenantSettings/validTz); una zona
//    inválida lanza RangeError. Una fecha mal formada lanza Error (nunca devuelve "NaN-NaN-NaN").
//  - Rangos: inclusivos por días locales; rangeToInstants devuelve [fromInstant, toInstant).
//  - startOfDayUTC: si la medianoche local no existe (salto de horario), el día arranca en la
//    transición; si ocurre dos veces (retroceso), toma la primera.

export type DateRange = { from: string; to: string };

const pad = (n: number, w = 2) => String(n).padStart(w, "0");
const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmtFor(tz: string): Intl.DateTimeFormat {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
    fmtCache.set(tz, f); // una zona inválida lanza antes del set: la caché solo guarda zonas IANA reales
  }
  return f;
}

function partsIn(instant: Date, tz: string) {
  const o: Record<string, number> = {};
  for (const p of fmtFor(tz).formatToParts(instant)) if (p.type !== "literal") o[p.type] = Number(p.value);
  const r = { y: o.year, m: o.month, d: o.day, h: o.hour, mi: o.minute, s: o.second };
  if (![r.y, r.m, r.d, r.h, r.mi, r.s].every(Number.isFinite)) throw new Error(`No se pudo descomponer la fecha en la zona ${tz}`);
  return r;
}

/** ¿Es un "YYYY-MM-DD" real? Rechaza "2026-02-30", instantes ISO completos y basura. */
export function isDateISO(s: unknown): s is string {
  if (typeof s !== "string" || !DATE_ISO.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  if (y < 1000 || y > 9999) return false; // fuera de ese rango Date.UTC remapea años y el ISO cambia de ancho
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}
function assertDateISO(s: string): void {
  if (!isDateISO(s)) throw new Error(`Fecha local inválida: ${s}`);
}
const toISO = (t: Date) => `${pad(t.getUTCFullYear(), 4)}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;

/** Desfase de la zona (minutos respecto a UTC) en un instante dado. Caracas → -240. */
export function tzOffsetMinutes(instant: Date, tz: string): number {
  const p = partsIn(instant, tz);
  const asUTC = new Date(Date.UTC(p.y, p.m - 1, p.d)).getTime() + ((p.h * 60 + p.mi) * 60 + p.s) * 1000;
  return Math.round((asUTC - instant.getTime()) / 60000);
}

/** "YYYY-MM-DD" del instante en la zona. */
export function localDateISO(instant: Date, tz: string): string {
  const p = partsIn(instant, tz);
  return `${pad(p.y, 4)}-${pad(p.m)}-${pad(p.d)}`;
}

/** Hoy en la zona. `now` es inyectable para tests. */
export function todayISO(tz: string, now: Date = new Date()): string {
  return localDateISO(now, tz);
}

/** Suma días a una fecha local sin pasar por la zona del proceso. */
export function addDaysISO(dateISO: string, n: number): string {
  if (!Number.isSafeInteger(n)) throw new Error(`Desplazamiento de días inválido: ${n}`);
  assertDateISO(dateISO);
  const [y, m, d] = dateISO.split("-").map(Number);
  return toISO(new Date(Date.UTC(y, m - 1, d + n)));
}

/** Instante UTC (ISO) de la medianoche local de `dateISO` en la zona. */
export function startOfDayUTC(dateISO: string, tz: string): string {
  assertDateISO(dateISO);
  const [y, m, d] = dateISO.split("-").map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d)).getTime();
  const a = guess - tzOffsetMinutes(new Date(guess), tz) * 60000;
  const b = guess - tzOffsetMinutes(new Date(a), tz) * 60000;
  // Candidatos que de verdad caen en el día pedido; si ninguno (medianoche dentro de un salto de
  // horario), el primer instante del día es la transición misma = el mayor de los dos.
  const valid = [a, b].filter((t) => localDateISO(new Date(t), tz) === dateISO);
  return new Date(valid.length ? Math.min(...valid) : Math.max(a, b)).toISOString();
}

/** Rango de días locales inclusivo → [fromInstant, toInstant) para filtrar columnas timestamptz.
 *  Un rango invertido se normaliza (from/to intercambiados) en vez de devolver vacío en silencio. */
export function rangeToInstants(range: DateRange, tz: string): { fromInstant: string; toInstant: string } {
  assertDateISO(range.from); assertDateISO(range.to);
  const [from, to] = range.from <= range.to ? [range.from, range.to] : [range.to, range.from];
  return { fromInstant: startOfDayUTC(from, tz), toInstant: startOfDayUTC(addDaysISO(to, 1), tz) };
}
