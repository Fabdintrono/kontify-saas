import { isDateISO, DEFAULT_TZ } from "@/lib/tz";

export function formatMoney(amount: number | null | undefined, currency = "USD"): string {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) return "—";
  const n = Number(amount);
  const fmt = (c: string) =>
    new Intl.NumberFormat("es-VE", { style: "currency", currency: c, minimumFractionDigits: 2 }).format(Math.abs(n));
  let texto: string;
  try { texto = fmt(currency); } catch { texto = fmt("USD"); }
  // El negativo va delante de todo. Formateado tal cual, es-VE devuelve «USD-587,50»,
  // con el signo pegado a la moneda, que se lee fatal. Desde que hay gastos, la
  // utilidad puede ser negativa y esto se ve.
  return n < 0 ? `-${texto}` : texto;
}

function dateFormatter(tz: string): Intl.DateTimeFormat {
  const opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit", year: "numeric" };
  try { return new Intl.DateTimeFormat("es-VE", { ...opts, timeZone: tz || DEFAULT_TZ }); }
  catch { return new Intl.DateTimeFormat("es-VE", { ...opts, timeZone: DEFAULT_TZ }); }
}

/** Timestamp (ISO con zona) → "dd/mm/aaaa" en la zona de la empresa. Nunca lanza.
 *  Si por error recibe una columna DATE ("YYYY-MM-DD"), la muestra tal cual sin correrla un día. */
export function formatDate(iso: string | null | undefined, tz: string): string {
  if (!iso) return "—";
  if (isDateISO(iso)) return formatDateOnly(iso);
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return dateFormatter(tz).format(d);
}

/** Columna DATE ("YYYY-MM-DD") → "dd/mm/aaaa" sin interpretar zona (new Date("2026-10-01") daría 30/09 en Venezuela).
 *  Rechaza instantes completos y fechas inválidas con "—" en vez de inventar un día. */
export function formatDateOnly(dateISO: string | null | undefined): string {
  if (!isDateISO(dateISO)) return "—";
  const [y, m, d] = dateISO.split("-");
  return `${d}/${m}/${y}`;
}

/** "YYYY-MM-DD" → "lun" … "dom" (minúsculas, como lo devuelve es-VE). "—" si la fecha no es válida. */
export function weekdayShort(dateISO: string | null | undefined): string {
  if (!isDateISO(dateISO)) return "—";
  const [y, m, d] = dateISO.split("-").map(Number);
  return new Intl.DateTimeFormat("es-VE", { timeZone: "UTC", weekday: "short" }).format(new Date(Date.UTC(y, m - 1, d)));
}
