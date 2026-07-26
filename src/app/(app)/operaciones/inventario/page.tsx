import { Boxes } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { listStock } from "@/lib/inventario/queries";
import { canManageStock } from "@/lib/inventario/permissions";
import { StockToolbar } from "@/components/inventario/stock-toolbar";
import { StockTable } from "@/components/inventario/stock-table";
import { StockRowCard } from "@/components/inventario/stock-row-card";
import { StockAdjustForm } from "@/components/inventario/stock-adjust-form";
import { EmptyState } from "@/components/shared/empty-state";
import type { Role } from "@/lib/auth/roles";

export default async function InventarioPage({ searchParams }: {
  searchParams: Promise<{ q?: string; status?: string; branch?: string }>;
}) {
  const sp = await searchParams;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  const { data: mem } = await sb.from("memberships").select("role, branch_id").eq("user_id", user!.id).single();
  const role = (mem?.role ?? "vendedor") as Role;
  const isBackOffice = ["owner", "admin", "administrativo"].includes(role);
  const status = (["todos", "bajo", "agotado"].includes(sp.status ?? "") ? sp.status : "todos") as "todos" | "bajo" | "agotado";
  // operativos: siempre su sucursal; back-office: la elegida (o consolidada)
  const branchId = isBackOffice ? (sp.branch || null) : (mem?.branch_id ?? null);

  const [rows, { data: branches }] = await Promise.all([
    listStock(sb, { search: sp.q ?? "", status, branchId }),
    sb.from("branches").select("id, name").order("is_main", { ascending: false }),
  ]);

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-extrabold tracking-[-0.4px] text-[var(--text)]">Inventario</h1>
        {canManageStock(role) && (
          <StockAdjustForm products={rows.map((r) => ({ id: r.productId, name: r.name }))}
            branches={(branches ?? []) as any} userBranchId={mem?.branch_id ?? null} isBackOffice={isBackOffice} />
        )}
      </div>

      <StockToolbar branches={(branches ?? []) as any} showBranch={isBackOffice} />

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
          <EmptyState icon={Boxes} title="Aún no hay productos con stock" hint="Carga existencias con “Registrar movimiento”." />
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-2 lg:p-4">
          <StockTable rows={rows} />
          <div className="space-y-2 lg:hidden">{rows.map((r) => <StockRowCard key={r.productId} r={r} />)}</div>
        </div>
      )}
    </div>
  );
}
