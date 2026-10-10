import type { LucideIcon } from "lucide-react";
import { Pencil, Check, CircleCheck, CircleDot, Clock, TriangleAlert, X, Send, ArrowRightLeft } from "lucide-react";

/** Tonos con su par claro/oscuro medidos ≥ 4,5:1 sobre --surface y sobre --bg (fila con hover). */
export const TONE = {
  neutral: "bg-[var(--bg)] text-[#475569] dark:text-[var(--text-soft)]",
  info:    "bg-[#0e7490]/10 text-[#155e75] dark:text-[#5eead4]",
  ok:      "bg-[#0f766e]/10 text-[#115e59] dark:text-[#6ee7b7]",
  warn:    "bg-[#b45309]/10 text-[#92400e] dark:text-[#fbbf24]",
  danger:  "bg-[#dc2626]/10 text-[#b91c1c] dark:text-[#f87171]",
  accent:  "bg-[#7c3aed]/10 text-[#6d28d9] dark:text-[#c4b5fd]",
} as const;
export type Tone = keyof typeof TONE;

const ICONS = {
  pencil: Pencil, check: Check, circleCheck: CircleCheck, dot: CircleDot,
  clock: Clock, alert: TriangleAlert, x: X, send: Send, convert: ArrowRightLeft,
} as const;
export type BadgeIcon = keyof typeof ICONS;

/** Chip de estado: color + icono + texto (nunca solo color), en una sola línea. */
export function StatusBadge({ tone, icon, label }: { tone: Tone; icon?: BadgeIcon; label: string }) {
  const Icon: LucideIcon | null = icon ? ICONS[icon] : null;
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${TONE[tone]}`}>
      {Icon && <Icon className="h-3 w-3 shrink-0" strokeWidth={2.5} aria-hidden="true" />}{label}
    </span>
  );
}
