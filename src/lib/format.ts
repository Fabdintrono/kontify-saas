export function formatMoney(amount: number | null | undefined, currency = "USD"): string {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) return "—";
  try {
    return new Intl.NumberFormat("es-VE", { style: "currency", currency, minimumFractionDigits: 2 }).format(Number(amount));
  } catch {
    return new Intl.NumberFormat("es-VE", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(Number(amount));
  }
}
