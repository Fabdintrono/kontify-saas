export function formatMoney(amount: number | null | undefined, currency = "USD"): string {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) return "—";
  try {
    return new Intl.NumberFormat("es-VE", { style: "currency", currency, minimumFractionDigits: 2 }).format(Number(amount));
  } catch {
    return new Intl.NumberFormat("es-VE", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(Number(amount));
  }
}

/** Timestamp (ISO con zona) → "dd/mm/aaaa" en la zona de la empresa. */
export function formatDate(iso: string | null | undefined, tz: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("es-VE", { timeZone: tz, day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
}

/** Columna DATE ("YYYY-MM-DD") → "dd/mm/aaaa" sin interpretar zona (new Date("2026-10-01") daría 30/09 en Venezuela). */
export function formatDateOnly(dateISO: string | null | undefined): string {
  if (!dateISO) return "—";
  const [y, m, d] = dateISO.slice(0, 10).split("-");
  if (!y || !m || !d) return "—";
  return `${d}/${m}/${y}`;
}

/** "YYYY-MM-DD" → "lun" … "dom" (minúsculas, como lo devuelve es-VE). */
export function weekdayShort(dateISO: string): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  return new Intl.DateTimeFormat("es-VE", { timeZone: "UTC", weekday: "short" }).format(new Date(Date.UTC(y, m - 1, d)));
}
