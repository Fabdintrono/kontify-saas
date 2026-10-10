import Link from "next/link";
import { CircleCheck, Circle, Rocket } from "lucide-react";
import { ActionButton } from "@/components/ui/action-button";
import { flashFor } from "@/lib/flash";
import type { GettingStartedStatus } from "@/lib/dashboard/getting-started";
import type { ActionResult } from "@/lib/action-result";

/** Checklist «Primeros pasos»: se calcula con datos reales y desaparece cuando el dueño lo oculta. */
export function GettingStarted({ status, canHide, action }: {
  status: GettingStartedStatus; canHide: boolean; action: (fd: FormData) => Promise<ActionResult>;
}) {
  if (status.hidden || status.items.length === 0) return null;
  const complete = status.done === status.total;
  const pct = Math.round((status.done / status.total) * 100);
  return (
    <section aria-labelledby="primeros-pasos" className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-[#0e7490] to-[#14b8a6] text-white"><Rocket className="h-4 w-4" strokeWidth={2} aria-hidden="true" /></span>
          <div>
            <h2 id="primeros-pasos" className="text-sm font-bold text-[var(--text)]">Primeros pasos</h2>
            <p className="text-xs text-[var(--text-soft)]">{complete ? "Todo listo. Kontify ya está trabajando contigo." : "Cinco pasos para dejar Kontify funcionando."}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-[var(--text-soft)]">{status.done} de {status.total}</span>
          {complete && canHide && (
            <ActionButton action={action} payload={{}} successToast={flashFor("primeros-pasos-ocultos")} pendingLabel="Ocultando…"
              className="rounded-[10px] border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--text)]">
              Ocultar
            </ActionButton>
          )}
        </div>
      </div>
      <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-[var(--bg)]" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-gradient-to-r from-[#0e7490] to-[#14b8a6]" style={{ width: `${pct}%` }} />
      </div>
      <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {status.items.map((it) => (
          <li key={it.key}>
            {it.done ? (
              <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] p-2.5 text-sm text-[var(--text-soft)] line-through">
                <CircleCheck className="h-4 w-4 shrink-0 text-[#0f766e] dark:text-[#6ee7b7]" strokeWidth={2} aria-hidden="true" />{it.label}
              </div>
            ) : (
              <Link href={it.href} className="flex items-center gap-2 rounded-lg border border-[var(--border)] p-2.5 text-sm font-medium text-[var(--text)] hover:bg-[var(--bg)]">
                <Circle className="h-4 w-4 shrink-0 text-[var(--text-soft)]" strokeWidth={2} aria-hidden="true" />{it.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
