"use client";
import { Toolbar, SearchField, useFilterParams, TOOLBAR_SELECT } from "@/components/shared/toolbar";

export function QuotesToolbar() {
  const { sp, pending, setParam } = useFilterParams();
  return (
    <Toolbar pending={pending}>
      <SearchField label="Buscar presupuestos" placeholder="Buscar por número o cliente…"
        value={sp.get("q") ?? ""} onSearch={(v) => setParam("q", v)} />
      <label htmlFor="f-estado-presu" className="sr-only">Filtrar por estado</label>
      <select id="f-estado-presu" className={TOOLBAR_SELECT} value={sp.get("status") ?? "todos"} onChange={(e) => setParam("status", e.target.value)}>
        <option value="todos">Todos los estados</option>
        <option value="borradores">Borradores</option>
        <option value="enviados">Enviados</option>
        <option value="aceptados">Aceptados</option>
        <option value="rechazados">Rechazados</option>
        <option value="convertidos">Convertidos</option>
      </select>
    </Toolbar>
  );
}
