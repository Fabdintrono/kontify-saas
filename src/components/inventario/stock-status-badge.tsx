import { StatusBadge, type BadgeIcon, type Tone } from "@/components/ui/status-badge";
import type { StockStatus } from "@/lib/inventario/queries";

const MAP: Record<StockStatus, { label: string; tone: Tone; icon: BadgeIcon }> = {
  en_stock: { label: "En stock", tone: "ok",     icon: "circleCheck" },
  bajo:     { label: "Bajo",     tone: "warn",   icon: "alert" },
  agotado:  { label: "Agotado",  tone: "danger", icon: "x" },
};

export function StockStatusBadge({ status }: { status: StockStatus }) {
  const s = MAP[status] ?? MAP.en_stock;
  return <StatusBadge tone={s.tone} icon={s.icon} label={s.label} />;
}
