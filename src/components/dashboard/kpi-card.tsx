import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown } from "lucide-react";

export function KpiCard({ icon: Icon, label, value, trend, sub }: {
  icon: LucideIcon; label: string; value?: string; trend?: { dir: "up" | "down"; text: string }; sub?: string;
}) {
  const empty = value === undefined || value === null;
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-center gap-2">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#0e7490]/10 text-[#0e7490] dark:text-[#5eead4]">
          <Icon className="h-4 w-4" strokeWidth={2} />
        </div>
        <p className="text-xs font-medium text-[var(--text-soft)]">{label}</p>
      </div>
      <p className="mt-3 text-[22px] font-extrabold tracking-[-0.4px] text-[var(--text)]">{empty ? "—" : value}</p>
      {empty ? (
        <p className="text-xs text-[var(--text-soft)]">Sin datos aún</p>
      ) : (
        <div className="flex items-center gap-2 text-xs">
          {trend && (
            <span className={`inline-flex items-center gap-0.5 font-semibold ${trend.dir === "up" ? "text-[#0f766e] dark:text-[#6ee7b7]" : "text-[#dc2626] dark:text-[#f87171]"}`}>
              {trend.dir === "up" ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />} {trend.text}
            </span>
          )}
          {sub && <span className="text-[var(--text-soft)]">{sub}</span>}
        </div>
      )}
    </div>
  );
}
