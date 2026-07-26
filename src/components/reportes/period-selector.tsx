"use client";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { presetRange, type Preset } from "@/lib/reportes/ranges";

const PRESETS: { key: Preset; label: string }[] = [
  { key: "hoy", label: "Hoy" }, { key: "semana", label: "Esta semana" },
  { key: "mes", label: "Este mes" }, { key: "mes_pasado", label: "Mes pasado" },
];

export function PeriodSelector({ branches, showBranch }: { branches: { id: string; name: string }[]; showBranch: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  function push(next: URLSearchParams) { router.push(`${pathname}?${next.toString()}`); }
  function setPreset(p: Preset) {
    const r = presetRange(p, new Date());
    const n = new URLSearchParams(sp.toString());
    n.set("from", r.from); n.set("to", r.to);
    push(n);
  }
  function setDate(key: "from" | "to", val: string) {
    const n = new URLSearchParams(sp.toString());
    if (val) n.set(key, val); else n.delete(key);
    push(n);
  }
  function setBranch(val: string) {
    const n = new URLSearchParams(sp.toString());
    if (val) n.set("branch", val); else n.delete("branch");
    push(n);
  }

  const dateCls = "h-9 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 text-sm text-[var(--text)]";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap gap-1">
        {PRESETS.map((p) => (
          <button key={p.key} onClick={() => setPreset(p.key)}
            className="rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs font-medium text-[var(--text)] hover:bg-[var(--bg)]">
            {p.label}
          </button>
        ))}
      </div>
      <input type="date" className={dateCls} defaultValue={sp.get("from") ?? ""} onChange={(e) => setDate("from", e.target.value)} />
      <span className="text-sm text-[var(--text-soft)]">–</span>
      <input type="date" className={dateCls} defaultValue={sp.get("to") ?? ""} onChange={(e) => setDate("to", e.target.value)} />
      {showBranch && (
        <select className={dateCls} defaultValue={sp.get("branch") ?? ""} onChange={(e) => setBranch(e.target.value)}>
          <option value="">Todas las sucursales</option>
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      )}
    </div>
  );
}
