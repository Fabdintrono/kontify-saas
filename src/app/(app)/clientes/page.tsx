import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { listClients, listClientTypes, type ClientStatus } from "@/lib/clientes/queries";
import { ClientsToolbar } from "@/components/clientes/clients-toolbar";
import { ClientsTable } from "@/components/clientes/clients-table";
import { ClientRowCard } from "@/components/clientes/client-row-card";
import { EmptyState } from "@/components/shared/empty-state";

export default async function ClientesPage({ searchParams }: {
  searchParams: Promise<{ q?: string; type?: string; status?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const sb = await createClient();
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const status = (["activos", "archivados", "todos"].includes(sp.status ?? "") ? sp.status : "activos") as ClientStatus;

  const [types, list] = await Promise.all([
    listClientTypes(sb),
    listClients(sb, { search: sp.q ?? "", typeId: sp.type || null, status, page }),
  ]);
  const pages = Math.max(1, Math.ceil(list.total / list.pageSize));

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold tracking-[-0.4px] text-[var(--text)]">Clientes</h1>
        <Link href="/clientes/nuevo"
          className="flex items-center gap-1.5 rounded-[10px] bg-gradient-to-br from-[#0e7490] to-[#14b8a6] px-3 py-2 text-sm font-semibold text-white">
          <Plus className="h-4 w-4" strokeWidth={2.5} /> Nuevo cliente
        </Link>
      </div>

      <ClientsToolbar types={types} />

      {list.rows.length === 0 ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
          <EmptyState icon={Users} title="Aún no tienes clientes" hint="Crea el primero con “Nuevo cliente”." />
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-2 lg:p-4">
          <ClientsTable rows={list.rows} />
          <div className="space-y-2 lg:hidden">{list.rows.map((r) => <ClientRowCard key={r.id} r={r} />)}</div>
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <PageLink sp={sp} page={page - 1} disabled={page <= 1}>‹</PageLink>
          <span className="text-[var(--text-soft)]">{page} / {pages}</span>
          <PageLink sp={sp} page={page + 1} disabled={page >= pages}>›</PageLink>
        </div>
      )}
    </div>
  );
}

function PageLink({ sp, page, disabled, children }: {
  sp: Record<string, string | undefined>; page: number; disabled: boolean; children: React.ReactNode;
}) {
  if (disabled) return <span className="px-2 text-[var(--text-soft)] opacity-40">{children}</span>;
  const params = new URLSearchParams();
  if (sp.q) params.set("q", sp.q); if (sp.type) params.set("type", sp.type);
  if (sp.status) params.set("status", sp.status); params.set("page", String(page));
  return <Link href={`/clientes?${params.toString()}`} className="rounded px-2 text-[var(--text)] hover:bg-[var(--bg)]">{children}</Link>;
}
