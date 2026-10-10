import type { LucideIcon } from "lucide-react";
import { Pencil, Check, CircleCheck, CircleDot, Clock, TriangleAlert, X } from "lucide-react";
import type { PaymentStatus } from "@/lib/cobros/status";

type Spec = { label: string; cls: string; icon: LucideIcon };
const GRAY = "bg-[var(--bg)] text-[var(--text-soft)]";
const TEAL = "bg-[#0e7490]/10 text-[#0e7490] dark:text-[#5eead4]";
const GREEN = "bg-[#0f766e]/10 text-[#0f766e] dark:text-[#6ee7b7]";
const AMBER = "bg-[#b45309]/10 text-[#b45309] dark:text-[#fbbf24]";
const RED = "bg-[#dc2626]/10 text-[#dc2626] dark:text-[#f87171]";

const DOC: Record<string, Spec> = {
  draft:  { label: "Borrador", cls: GRAY, icon: Pencil },
  issued: { label: "Emitida",  cls: TEAL, icon: Check },
  void:   { label: "Anulada",  cls: RED,  icon: X },
};
const PAY: Record<PaymentStatus, Spec> = {
  pagada:    { label: "Pagada",    cls: GREEN, icon: CircleCheck },
  parcial:   { label: "Parcial",   cls: AMBER, icon: CircleDot },
  pendiente: { label: "Pendiente", cls: AMBER, icon: Clock },
  vencida:   { label: "Vencida",   cls: RED,   icon: TriangleAlert },
};

/** Estado del documento; si está emitida y se conoce el estado de pago, muestra ese (es lo que importa al usuario). */
export function SaleStatusBadge({ status, paymentStatus }: { status: string; paymentStatus?: PaymentStatus | null }) {
  const s = (status === "issued" && paymentStatus) ? PAY[paymentStatus] : (DOC[status] ?? { label: status, cls: GRAY, icon: Check });
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}>
      <Icon className="h-3 w-3" strokeWidth={2.5} aria-hidden="true" />{s.label}
    </span>
  );
}
