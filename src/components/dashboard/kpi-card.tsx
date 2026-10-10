import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { Trend } from "@/lib/dashboard/trends";
import { DANGER_TEXT } from "@/lib/ui-tokens";

/** Comparación contra el mismo tramo del mes pasado.
 *
 *  La flecha acompaña al color, nunca lo sustituye: quien no distingue verde de rojo
 *  sigue leyendo si sube o baja. Sin base previa no se pinta porcentaje: inventar
 *  «+100 %» porque el mes pasado no hubo nada no informa de nada. */
export function TrendChip({ trend, formato }: { trend: Trend; formato: (n: number) => string }) {
  if (trend.pct === null) {
    return (
      <span className="text-xs text-[var(--text-soft)]">
        {trend.motivo === "sin-datos" ? "Igual que el mes pasado" : "Primer mes con datos"}
      </span>
    );
  }
  const sube = trend.pct > 0, igual = trend.pct === 0;
  const Icon = igual ? Minus : sube ? TrendingUp : TrendingDown;
  const color = igual ? "text-[var(--text-soft)]" : sube ? "text-[#0f766e] dark:text-[#6ee7b7]" : DANGER_TEXT;
  return (
    <span className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-xs">
      <span className={`inline-flex items-center gap-0.5 font-semibold tabular-nums ${color}`}>
        <Icon className="h-3 w-3 shrink-0" strokeWidth={2.5} aria-hidden="true" />
        {sube ? "+" : ""}{trend.pct}%
      </span>
      <span className="text-[var(--text-soft)]">
        vs. {formato(trend.previo)} en los mismos días del mes pasado
      </span>
    </span>
  );
}

export function KpiCard({ icon: Icon, label, value, trend, sub }: {
  icon: LucideIcon; label: string; value?: string;
  trend?: React.ReactNode; sub?: string;
}) {
  const empty = value === undefined || value === null;
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-center gap-2">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#0e7490]/10 text-[#0e7490] dark:text-[#5eead4]">
          <Icon className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
        </div>
        <p className="text-xs font-medium text-[var(--text-soft)]">{label}</p>
      </div>
      <p className="mt-3 text-[22px] font-extrabold tracking-[-0.4px] tabular-nums text-[var(--text)]">{empty ? "—" : value}</p>
      {empty
        ? <p className="text-xs text-[var(--text-soft)]">Sin datos aún</p>
        : <div className="mt-0.5 min-h-4 text-xs">{trend}{sub && <span className="text-[var(--text-soft)]">{sub}</span>}</div>}
    </div>
  );
}
