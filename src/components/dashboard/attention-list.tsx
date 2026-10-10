import Link from "next/link";
import { CircleCheck, TriangleAlert, CircleAlert } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import type { AttentionItem } from "@/lib/dashboard/attention";

export type { AttentionItem };

export function AttentionList({ items, canSeeReceivables }: { items: AttentionItem[]; canSeeReceivables: boolean }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <p className="mb-2 text-sm font-bold text-[var(--text)]">Requieren atención</p>
      {items.length === 0 ? (
        <EmptyState icon={CircleCheck} title="Todo en orden" hint="No hay ventas vencidas ni productos por reponer." />
      ) : (
        <ul className="space-y-2">
          {items.map((it, i) => {
            const Icon = it.tone === "danger" ? CircleAlert : TriangleAlert;
            const color = it.tone === "danger" ? "text-[#dc2626]" : "text-[#b45309] dark:text-[#fbbf24]";
            return (
              <li key={i}>
                <Link href={it.href} className="flex items-start gap-2 rounded-lg border border-[var(--border)] p-2.5 hover:bg-[var(--bg)]">
                  <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${color}`} strokeWidth={2} aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--text)]">{it.title}</p>
                    <p className="text-xs text-[var(--text-soft)]">{it.detail}</p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {/* El cupo del panel es corto: si hay vencidas, la lista completa vive en Cuentas por cobrar.
          Quien no puede verla no recibe el enlace: la pantalla lo devolvería al dashboard. */}
      {canSeeReceivables && items.some((i) => i.kind === "vencida") && (
        <p className="mt-2 text-right">
          <Link href="/finanzas/cuentas-por-cobrar?filter=vencidos" className="text-xs font-semibold text-[#0e7490] hover:underline">
            Ver todas las vencidas
          </Link>
        </p>
      )}
    </div>
  );
}
