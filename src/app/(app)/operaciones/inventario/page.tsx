import { Suspense } from "react";
import { Boxes } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { listStock, STOCK_SORT } from "@/lib/inventario/queries";
import { canManageStock } from "@/lib/inventario/permissions";
import { resolveSort } from "@/lib/sorting";
import { StockToolbar } from "@/components/inventario/stock-toolbar";
import { StockTable, STOCK_COL_WIDTHS } from "@/components/inventario/stock-table";
import { StockRowCard } from "@/components/inventario/stock-row-card";
import { StockAdjustForm } from "@/components/inventario/stock-adjust-form";
import { EmptyState } from "@/components/shared/empty-state";
import { ModuleHeader } from "@/components/shared/module-header";
import { ModuleGuide } from "@/components/shared/module-guide";
import { Page } from "@/components/shared/page";
import { ListBox } from "@/components/shared/list-box";
import { Loading, TableSkeleton } from "@/components/ui/skeleton";
import { GUIDES } from "@/lib/guides";
import type { Role } from "@/lib/auth/roles";

type Params = { q?: string; status?: string; branch?: string; sort?: string; dir?: string };

export default async function InventarioPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  const { data: mem } = await sb.from("memberships").select("role, branch_id").eq("user_id", user!.id).single();
  const role = (mem?.role ?? "vendedor") as Role;
  const isBackOffice = ["owner", "admin", "administrativo"].includes(role);
  // operativos: siempre su sucursal; back-office: la elegida (o consolidada)
  const branchId = isBackOffice ? (sp.branch || null) : (mem?.branch_id ?? null);

  const [{ data: branches }, { data: allProducts }] = await Promise.all([
    sb.from("branches").select("id, name").order("is_main", { ascending: false }),
    // lista completa de productos 'good' activos para el ajuste (independiente de los filtros de la tabla)
    sb.from("products").select("id, name").eq("kind", "good").eq("active", true).order("name"),
  ]);

  return (
    <Page>
      <ModuleHeader module="inventario" actions={canManageStock(role) ? (
        <StockAdjustForm products={(allProducts ?? []) as any}
          branches={(branches ?? []) as any} userBranchId={mem?.branch_id ?? null} isBackOffice={isBackOffice} />
      ) : undefined} />

      <StockToolbar branches={(branches ?? []) as any} showBranch={isBackOffice} />

      <Suspense key={`${sp.q}|${sp.status}|${sp.branch}|${sp.sort}|${sp.dir}`}
        fallback={<Loading><TableSkeleton widths={STOCK_COL_WIDTHS} /></Loading>}>
        <StockList sp={sp} role={role} branchId={branchId} />
      </Suspense>
    </Page>
  );
}

async function StockList({ sp, role, branchId }: { sp: Params; role: Role; branchId: string | null }) {
  const sb = await createClient();
  const status = (["todos", "bajo", "agotado"].includes(sp.status ?? "") ? sp.status : "todos") as "todos" | "bajo" | "agotado";
  const sort = resolveSort(STOCK_SORT, sp.sort, sp.dir);
  const rows = await listStock(sb, { search: sp.q ?? "", status, branchId, sort: sp.sort, dir: sp.dir });

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        <EmptyState icon={Boxes} title="Sin existencias registradas"
          hint={canManageStock(role) ? "Carga la existencia inicial de cada producto con «Ajustar stock»." : "Pide a un administrador o a almacén que cargue las existencias."}
          secondary={<ModuleGuide guide={GUIDES.inventario} />} />
      </div>
    );
  }

  return (
    <ListBox>
      <StockTable rows={rows} sort={sort} />
      <div className="space-y-2 lg:hidden">{rows.map((r) => <StockRowCard key={r.productId} r={r} />)}</div>
    </ListBox>
  );
}
