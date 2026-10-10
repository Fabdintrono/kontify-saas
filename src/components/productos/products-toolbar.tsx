"use client";
import { Toolbar, SearchField, useFilterParams, TOOLBAR_SELECT } from "@/components/shared/toolbar";

export function ProductsToolbar({ categories }: { categories: { id: string; name: string }[] }) {
  const { sp, pending, setParam } = useFilterParams();
  return (
    <Toolbar pending={pending}>
      <SearchField label="Buscar productos" placeholder="Buscar por nombre o SKU…"
        value={sp.get("q") ?? ""} onSearch={(v) => setParam("q", v)} />
      <label htmlFor="f-categoria" className="sr-only">Filtrar por categoría</label>
      <select id="f-categoria" className={TOOLBAR_SELECT} value={sp.get("category") ?? ""} onChange={(e) => setParam("category", e.target.value)}>
        <option value="">Todas las categorías</option>
        {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <label htmlFor="f-clase" className="sr-only">Filtrar por bien o servicio</label>
      <select id="f-clase" className={TOOLBAR_SELECT} value={sp.get("kind") ?? ""} onChange={(e) => setParam("kind", e.target.value)}>
        <option value="">Bien y servicio</option>
        <option value="good">Bien</option>
        <option value="service">Servicio</option>
      </select>
      <label htmlFor="f-estado-prod" className="sr-only">Filtrar por estado</label>
      <select id="f-estado-prod" className={TOOLBAR_SELECT} value={sp.get("status") ?? "activos"} onChange={(e) => setParam("status", e.target.value)}>
        <option value="activos">Activos</option>
        <option value="archivados">Archivados</option>
        <option value="todos">Todos</option>
      </select>
    </Toolbar>
  );
}
