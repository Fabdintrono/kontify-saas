"use client";
import { Toolbar, SearchField, useFilterParams, TOOLBAR_SELECT } from "@/components/shared/toolbar";

export function ClientsToolbar({ types }: { types: { id: string; name: string }[] }) {
  const { sp, pending, setParam } = useFilterParams();
  return (
    <Toolbar pending={pending}>
      <SearchField label="Buscar clientes" placeholder="Buscar por nombre, teléfono, email…"
        value={sp.get("q") ?? ""} onSearch={(v) => setParam("q", v)} />
      <label htmlFor="f-tipo" className="sr-only">Filtrar por tipo</label>
      <select id="f-tipo" className={TOOLBAR_SELECT} value={sp.get("type") ?? ""} onChange={(e) => setParam("type", e.target.value)}>
        <option value="">Todos los tipos</option>
        {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
      <label htmlFor="f-estado" className="sr-only">Filtrar por estado</label>
      <select id="f-estado" className={TOOLBAR_SELECT} value={sp.get("status") ?? "activos"} onChange={(e) => setParam("status", e.target.value)}>
        <option value="activos">Activos</option>
        <option value="archivados">Archivados</option>
        <option value="todos">Todos</option>
      </select>
    </Toolbar>
  );
}
