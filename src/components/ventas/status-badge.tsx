import { StatusBadge, type BadgeIcon, type Tone } from "@/components/ui/status-badge";
import { PAYMENT_LABEL, type PaymentStatus } from "@/lib/cobros/status";

type Spec = { label: string; tone: Tone; icon: BadgeIcon };

/** Rojo de «peligro» para texto fuera del chip (saldo vencido), con el mismo contraste. */
export const DANGER_TEXT = "font-medium text-[#b91c1c] dark:text-[#f87171]";

const DOC: Record<string, Spec> = {
  draft:  { label: "Borrador", tone: "neutral", icon: "pencil" },
  // Respaldo: en la app toda emitida llega con paymentStatus; se conserva por tolerancia.
  issued: { label: "Emitida",  tone: "info",    icon: "check" },
  void:   { label: "Anulada",  tone: "danger",  icon: "x" },
};
const PAY: Record<PaymentStatus, Spec> = {
  pagada:    { label: PAYMENT_LABEL.pagada,    tone: "ok",     icon: "circleCheck" },
  parcial:   { label: PAYMENT_LABEL.parcial,   tone: "warn",   icon: "dot" },
  pendiente: { label: PAYMENT_LABEL.pendiente, tone: "warn",   icon: "clock" },
  vencida:   { label: PAYMENT_LABEL.vencida,   tone: "danger", icon: "alert" },
};

/** Estado del documento; si está emitida y se conoce el estado de pago, muestra ese (es lo que importa al usuario). */
export function SaleStatusBadge({ status, paymentStatus }: { status: string; paymentStatus?: PaymentStatus | null }) {
  const s = (status === "issued" && paymentStatus) ? PAY[paymentStatus] : (DOC[status] ?? { label: status, tone: "neutral" as Tone, icon: "check" as BadgeIcon });
  return <StatusBadge tone={s.tone} icon={s.icon} label={s.label} />;
}
