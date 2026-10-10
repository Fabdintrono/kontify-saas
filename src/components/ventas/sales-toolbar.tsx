"use client";
import { Toolbar, SearchField, useFilterParams, TOOLBAR_SELECT } from "@/components/shared/toolbar";

export function SalesToolbar() {
  const { sp, pending, setParam } = useFilterParams();
  return (
    <Toolbar pending={pending}>
      <SearchField label="Buscar ventas" placeholder="Buscar por número o cliente…"
        value={sp.get("q") ?? ""} onSearch={(v) => setParam("q", v)} />
      <label htmlFor="f-estado-venta" className="sr-only">Filtrar por estado</label>
      <select id="f-estado-venta" className={TOOLBAR_SELECT} value={sp.get("status") ?? "todas"} onChange={(e) => setParam("status", e.target.value)}>
        <option value="todas">Todos los estados</option>
        <option value="borradores">Borradores</option>
        <option value="emitidas">Emitidas</option>
        <option value="anuladas">Anuladas</option>
      </select>
      <label htmlFor="f-pago" className="sr-only">Filtrar por estado de pago</label>
      <select id="f-pago" className={TOOLBAR_SELECT} value={sp.get("payment") ?? "todas"} onChange={(e) => setParam("payment", e.target.value)}>
        <option value="todas">Pago: todas</option>
        <option value="pendientes">Con saldo</option>
        <option value="vencidas">Vencidas</option>
      </select>
    </Toolbar>
  );
}
