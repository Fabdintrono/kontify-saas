import { Suspense } from "react";
import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { listClients, listClientTypes, CLIENTS_SORT, type ClientStatus } from "@/lib/clientes/queries";
import { resolveSort } from "@/lib/sorting";
import { ClientsToolbar } from "@/components/clientes/clients-toolbar";
import { ClientsTable, CLIENT_COL_WIDTHS } from "@/components/clientes/clients-table";
import { ClientRowCard } from "@/components/clientes/client-row-card";
import { EmptyState } from "@/components/shared/empty-state";
import { buttonCls } from "@/components/ui/button";
import { ModuleHeader } from "@/components/shared/module-header";
import { ModuleGuide } from "@/components/shared/module-guide";
import { Page } from "@/components/shared/page";
import { Pagination } from "@/components/shared/pagination";
import { ListBox } from "@/components/shared/list-box";
import { Loading, TableSkeleton } from "@/components/ui/skeleton";
import { GUIDES } from "@/lib/guides";

type Params = { q?: string; type?: string; status?: string; page?: string; sort?: string; dir?: string };

export default async function ClientesPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const sb = await createClient();
  const types = await listClientTypes(sb);

  return (
    <Page>
      <ModuleHeader module="clientes" actions={
        <Link href="/clientes/nuevo" className={buttonCls("primary")}>
          <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" /> Nuevo cliente
        </Link>} />

      <ClientsToolbar types={types} />

      {/* La clave cambia con cada filtro, búsqueda, orden o página: el bloque vuelve a
          suspenderse y se ve el esqueleto en vez de la lista vieja congelada. */}
      <Suspense key={`${sp.q}|${sp.type}|${sp.status}|${sp.sort}|${sp.dir}|${sp.page}`}
        fallback={<Loading><TableSkeleton widths={CLIENT_COL_WIDTHS} /></Loading>}>
        <ClientsList sp={sp} />
      </Suspense>
    </Page>
  );
}

async function ClientsList({ sp }: { sp: Params }) {
  const sb = await createClient();
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const status = (["activos", "archivados", "todos"].includes(sp.status ?? "") ? sp.status : "activos") as ClientStatus;
  const sort = resolveSort(CLIENTS_SORT, sp.sort, sp.dir);
  const list = await listClients(sb, { search: sp.q ?? "", typeId: sp.type || null, status, page, sort: sp.sort, dir: sp.dir });
  const pages = Math.max(1, Math.ceil(list.total / list.pageSize));

  if (list.rows.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        <EmptyState icon={Users} title="Aún no tienes clientes"
          hint="También puedes vender a Consumidor final sin crear uno."
          action={{ href: "/clientes/nuevo", label: "Nuevo cliente" }}
          secondary={<ModuleGuide guide={GUIDES.clientes} />} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ListBox>
        <ClientsTable rows={list.rows} sort={sort} />
        <div className="space-y-2 lg:hidden">{list.rows.map((r) => <ClientRowCard key={r.id} r={r} />)}</div>
      </ListBox>
      <Pagination basePath="/clientes" params={sp} page={page} pages={pages} />
    </div>
  );
}
