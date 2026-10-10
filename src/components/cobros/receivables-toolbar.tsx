"use client";
import { Toolbar, SearchField, useFilterParams, TOOLBAR_SELECT } from "@/components/shared/toolbar";

export function ReceivablesToolbar() {
  const { sp, pending, setParam } = useFilterParams();
  return (
    <Toolbar pending={pending}>
      <SearchField label="Buscar cliente con deuda" placeholder="Buscar cliente…"
        value={sp.get("q") ?? ""} onSearch={(v) => setParam("q", v)} />
      <label htmlFor="f-vencidos" className="sr-only">Filtrar por vencimiento</label>
      <select id="f-vencidos" className={TOOLBAR_SELECT} value={sp.get("filter") ?? "todos"} onChange={(e) => setParam("filter", e.target.value)}>
        <option value="todos">Todos</option>
        <option value="vencidos">Solo vencidos</option>
      </select>
    </Toolbar>
  );
}
