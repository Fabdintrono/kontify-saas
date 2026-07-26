import { formatMoney } from "@/lib/format";

export function BarChart({ data, currency }: { data: { label: string; value: number }[]; currency?: string }) {
  if (data.length === 0) return <p className="py-6 text-center text-sm text-[var(--text-soft)]">Sin datos en el período.</p>;
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="space-y-1.5">
      {data.map((d, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <span className="w-14 shrink-0 text-[var(--text-soft)]">{d.label}</span>
          <div className="h-4 flex-1 overflow-hidden rounded bg-[var(--bg)]">
            <div className="h-4 rounded bg-gradient-to-r from-[#0e7490] to-[#14b8a6]" style={{ width: `${(d.value / max) * 100}%` }} />
          </div>
          <span className="w-24 shrink-0 text-right text-[var(--text)]">{currency ? formatMoney(d.value, currency) : d.value}</span>
        </div>
      ))}
    </div>
  );
}
