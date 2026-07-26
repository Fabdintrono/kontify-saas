import Link from "next/link";
import { Plus, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { listSales, type SaleStatusFilter, type SalePaymentFilter } from "@/lib/ventas/queries";
import { canSell } from "@/lib/ventas/permissions";
import { SalesToolbar } from "@/components/ventas/sales-toolbar";
import { SalesTable } from "@/components/ventas/sales-table";
import { SaleRowCard } from "@/components/ventas/sale-row-card";
import { EmptyState } from "@/components/shared/empty-state";
import type { Role } from "@/lib/auth/roles";

export default async function FacturacionPage({ searchParams }: {
  searchParams: Promise<{ q?: string; status?: string; payment?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  const { data: mem } = await sb.from("memberships").select("role").eq("user_id", user!.id).single();
  const role = (mem?.role ?? "vendedor") as Role;
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const status = (["borradores", "emitidas", "anuladas", "todas"].includes(sp.status ?? "") ? sp.status : "todas") as SaleStatusFilter;
  const payment = (["pendientes", "todas"].includes(sp.payment ?? "") ? sp.payment : "todas") as SalePaymentFilter;

  const list = await listSales(sb, { search: sp.q ?? "", status, payment, page });
  const pages = Math.max(1, Math.ceil(list.total / list.pageSize));

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold tracking-[-0.4px] text-[var(--text)]">Facturación</h1>
        {canSell(role) && (
          <Link href="/operaciones/facturacion/nueva"
            className="flex items-center gap-1.5 rounded-[10px] bg-gradient-to-br from-[#0e7490] to-[#14b8a6] px-3 py-2 text-sm font-semibold text-white">
            <Plus className="h-4 w-4" strokeWidth={2.5} /> Nueva venta
          </Link>
        )}
      </div>

      <SalesToolbar />

      {list.rows.length === 0 ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
          <EmptyState icon={FileText} title="Aún no hay ventas" hint={"Crea la primera con “Nueva venta”."} />
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-2 lg:p-4">
          <SalesTable rows={list.rows} />
          <div className="space-y-2 lg:hidden">{list.rows.map((r) => <SaleRowCard key={r.id} r={r} />)}</div>
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
  if (sp.q) params.set("q", sp.q); if (sp.status) params.set("status", sp.status);
  if (sp.payment) params.set("payment", sp.payment); params.set("page", String(page));
  return <Link href={`/operaciones/facturacion?${params.toString()}`} className="rounded px-2 text-[var(--text)] hover:bg-[var(--bg)]">{children}</Link>;
}
