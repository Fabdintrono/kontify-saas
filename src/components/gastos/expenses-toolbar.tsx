"use client";
import { Toolbar, SearchField, useFilterParams, TOOLBAR_SELECT } from "@/components/shared/toolbar";
import { presetRangeFor, activePreset, PRESET_KEYS, type Preset } from "@/lib/reportes/ranges";

const PRESET_LABEL: Record<Preset, string> = {
  hoy: "Hoy", semana: "Esta semana", mes: "Este mes", mes_pasado: "Mes pasado",
};

export function ExpensesToolbar({ categories, today, from, to }: {
  categories: { id: string; name: string }[]; today: string; from: string; to: string;
}) {
  const { sp, pending, setParam, setParams } = useFilterParams();
  const activo = activePreset(today, { from, to });

  function setPreset(p: Preset) {
    const r = presetRangeFor(p, today);
    setParams({ from: r.from, to: r.to });
  }

  return (
    <Toolbar pending={pending}>
      <div className="flex flex-wrap gap-1">
        {PRESET_KEYS.map((key) => (
          <button key={key} type="button" onClick={() => setPreset(key)} aria-pressed={activo === key}
            className={`h-9 rounded-lg px-2.5 text-sm font-medium transition-colors ${
              activo === key
                ? "bg-[#0e7490] text-white"
                : "border border-[var(--border)] text-[var(--text)] hover:bg-[var(--bg)]"}`}>
            {PRESET_LABEL[key]}
          </button>
        ))}
      </div>
      <SearchField label="Buscar gastos" placeholder="Buscar por concepto o proveedor…"
        value={sp.get("q") ?? ""} onSearch={(v) => setParam("q", v)} />
      <label htmlFor="f-cat-gasto" className="sr-only">Filtrar por categoría</label>
      <select id="f-cat-gasto" className={TOOLBAR_SELECT} value={sp.get("category") ?? ""}
        onChange={(e) => setParam("category", e.target.value)}>
        <option value="">Todas las categorías</option>
        {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
    </Toolbar>
  );
}
