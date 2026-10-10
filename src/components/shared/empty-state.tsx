import Link from "next/link";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Plus } from "lucide-react";

/** Vacío que explica la causa y lleva a la acción (Polaris: «di por qué está vacío y qué hacer»).
 *  `tone="ok"` para vacíos buenos («Nadie te debe», «Todo en orden»). */
export function EmptyState({ icon: Icon, title, hint, action, secondary, tone = "neutral" }: {
  icon: LucideIcon; title: string; hint?: string;
  action?: { href: string; label: string; plus?: boolean };
  secondary?: ReactNode; tone?: "neutral" | "ok";
}) {
  const iconCls = tone === "ok" ? "text-[#0f766e] dark:text-[#6ee7b7]" : "text-[var(--text-soft)]";
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
      <div className="grid h-11 w-11 place-items-center rounded-xl border border-[var(--border)] bg-[var(--bg)]">
        <Icon className={`h-5 w-5 ${iconCls}`} strokeWidth={2} aria-hidden="true" />
      </div>
      <p className="text-sm font-semibold text-[var(--text)]">{title}</p>
      {hint && <p className="max-w-md text-xs text-[var(--text-soft)]">{hint}</p>}
      {(action || secondary) && (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
          {action && (
            <Link href={action.href}
              className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-br from-[#0e7490] to-[#14b8a6] px-3 py-2 text-sm font-semibold text-white">
              {action.plus !== false && <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />}{action.label}
            </Link>
          )}
          {secondary}
        </div>
      )}
    </div>
  );
}
