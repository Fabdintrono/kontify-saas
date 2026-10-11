import Link from "next/link";
import { Pencil } from "lucide-react";
import type { RecurringRow } from "@/lib/gastos/queries";
import { formatMoney, formatDateOnly } from "@/lib/format";
import { estadoVencimiento, textoVencimiento } from "@/lib/gastos/schedule";
import { FRECUENCIA_LABEL } from "@/lib/gastos/schema";
import { StatusBadge, type Tone } from "@/components/ui/status-badge";
import { ActionButton } from "@/components/ui/action-button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { buttonCls } from "@/components/ui/button";
import { flashFor } from "@/lib/flash";
import type { ActionResult } from "@/lib/action-result";

const TONO: Record<string, { tone: Tone; icon: "alert" | "clock" | "dot" }> = {
  vencido: { tone: "danger", icon: "alert" },
  hoy: { tone: "warn", icon: "clock" },
  proximo: { tone: "info", icon: "clock" },
  lejano: { tone: "neutral", icon: "dot" },
};

/** Los gastos fijos, ordenados por lo que vence antes.
 *
 *  No es una tabla: cada fila lleva su propio botón de pagar y su estado, y eso en una
 *  tabla de seis columnas se lee peor que en una ficha. */
export function RecurringList({ rows, currency, hoy, puedeEditar, puedeBorrar, onPay, onToggle, onDelete }: {
  rows: RecurringRow[]; currency: string; hoy: string;
  puedeEditar: boolean; puedeBorrar: boolean;
  onPay: (fd: FormData) => Promise<ActionResult>;
  onToggle: (fd: FormData) => Promise<ActionResult>;
  onDelete: (fd: FormData) => Promise<ActionResult>;
}) {
  return (
    <ul className="divide-y divide-[var(--border)]">
      {rows.map((r) => {
        const estado = estadoVencimiento(r.nextDue, hoy);
        const { tone, icon } = TONO[estado];
        const vencido = estado === "vencido" || estado === "hoy";
        return (
          <li key={r.id} className="flex flex-wrap items-center gap-3 px-1 py-3 transition-colors hover:bg-[var(--bg)] lg:px-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate font-medium text-[var(--text)]">{r.description}</p>
                {!r.active && <StatusBadge tone="neutral" label="Pausado" />}
              </div>
              <p className="mt-0.5 truncate text-xs text-[var(--text-soft)]">
                {FRECUENCIA_LABEL[r.frequency]} · {r.categoryName ?? "Sin categoría"} · próximo el {formatDateOnly(r.nextDue)}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-3">
              {r.active && <StatusBadge tone={tone} icon={icon} label={textoVencimiento(r.nextDue, hoy)} />}
              <p className="w-28 text-right font-semibold tabular-nums text-[var(--text)]">{formatMoney(r.amount, currency)}</p>
            </div>

            {puedeEditar && (
              <div className="flex w-full shrink-0 items-center justify-end gap-2 sm:w-auto">
                {r.active && (
                  <ActionButton action={onPay} payload={{ id: r.id }} pendingLabel="Registrando…"
                    successToast={flashFor("fijo-pagado")}
                    className={buttonCls(vencido ? "primary" : "secondary")}>
                    Registrar pago
                  </ActionButton>
                )}
                <Link href={`/finanzas/gastos/fijos/${r.id}/editar`} aria-label={`Editar ${r.description}`}
                  className={buttonCls("secondary", "w-10 px-0")}>
                  <Pencil className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                </Link>
                <ActionButton action={onToggle} payload={{ id: r.id, active: r.active ? "false" : "true" }}
                  pendingLabel="…" successToast={flashFor(r.active ? "fijo-pausado" : "fijo-reactivado")}
                  className={buttonCls("secondary")}>
                  {r.active ? "Pausar" : "Reactivar"}
                </ActionButton>
                {puedeBorrar && (
                  <ConfirmDialog action={onDelete} payload={{ id: r.id }}
                    title={`¿Eliminar «${r.description}»?`}
                    description="Deja de avisarte. Los pagos que ya registraste se conservan como gastos."
                    confirmLabel="Eliminar" tone="danger" successToast={flashFor("fijo-eliminado")}
                    triggerClassName={buttonCls("danger")}>
                    Eliminar
                  </ConfirmDialog>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
