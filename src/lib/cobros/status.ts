import { round2 } from "@/lib/ventas/totals";
import { assertDateISO } from "@/lib/tz";

export type PaymentStatus = "pagada" | "parcial" | "pendiente" | "vencida";
export type SaleLike = { status: string; total: number; paidAmount: number; dueDate: string | null };

/** Estado de pago derivado de una venta. `today` = "YYYY-MM-DD" en la zona de la empresa. Solo ventas emitidas. */
export function paymentStatusOf(s: SaleLike, today: string): PaymentStatus | null {
  assertDateISO(today);
  if (s.status !== "issued") return null;
  const balance = round2(Number(s.total) - Number(s.paidAmount));
  if (balance <= 0) return "pagada";
  if (s.dueDate && s.dueDate < today) return "vencida";
  return Number(s.paidAmount) > 0 ? "parcial" : "pendiente";
}

export const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  pagada: "Pagada", parcial: "Parcial", pendiente: "Pendiente", vencida: "Vencida",
};
