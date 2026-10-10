"use client";
import { Toolbar, SearchField, useFilterParams, TOOLBAR_SELECT } from "@/components/shared/toolbar";

export function StockToolbar({ branches, showBranch }: { branches: { id: string; name: string }[]; showBranch: boolean }) {
  const { sp, pending, setParam } = useFilterParams();
  return (
    <Toolbar pending={pending}>
      <SearchField label="Buscar existencias" placeholder="Buscar por nombre o SKU…"
        value={sp.get("q") ?? ""} onSearch={(v) => setParam("q", v)} />
      <label htmlFor="f-stock" className="sr-only">Filtrar por nivel de existencia</label>
      <select id="f-stock" className={TOOLBAR_SELECT} value={sp.get("status") ?? "todos"} onChange={(e) => setParam("status", e.target.value)}>
        <option value="todos">Todos</option>
        <option value="bajo">Bajo</option>
        <option value="agotado">Agotado</option>
      </select>
      {showBranch && (<>
        <label htmlFor="f-sucursal" className="sr-only">Filtrar por sucursal</label>
        <select id="f-sucursal" className={TOOLBAR_SELECT} value={sp.get("branch") ?? ""} onChange={(e) => setParam("branch", e.target.value)}>
          <option value="">Todas las sucursales</option>
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </>)}
    </Toolbar>
  );
}
