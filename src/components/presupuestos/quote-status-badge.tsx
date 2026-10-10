import { StatusBadge, type BadgeIcon, type Tone } from "@/components/ui/status-badge";

const MAP: Record<string, { label: string; tone: Tone; icon: BadgeIcon }> = {
  draft:     { label: "Borrador",   tone: "neutral", icon: "pencil" },
  sent:      { label: "Enviado",    tone: "info",    icon: "send" },
  accepted:  { label: "Aceptado",   tone: "ok",      icon: "circleCheck" },
  rejected:  { label: "Rechazado",  tone: "danger",  icon: "x" },
  converted: { label: "Convertido", tone: "accent",  icon: "convert" },
};

export function QuoteStatusBadge({ status }: { status: string }) {
  const s = MAP[status];
  if (!s) return <StatusBadge tone="neutral" label={status} />;
  return <StatusBadge tone={s.tone} icon={s.icon} label={s.label} />;
}
