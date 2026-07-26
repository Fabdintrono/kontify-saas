import { getProductStock, listMovements } from "@/lib/inventario/queries";
import { createClient } from "@/lib/supabase/server";
import { canManageStock } from "@/lib/inventario/permissions";
import { MovementsHistory } from "./movements-history";
import { StockAdjustForm } from "./stock-adjust-form";
import type { Role } from "@/lib/auth/roles";

export async function ProductStockPanel({ productId, kind, role, userBranchId }: {
  productId: string; kind: "good" | "service"; role: Role; userBranchId: string | null;
}) {
  if (kind === "service") {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <p className="text-sm font-bold text-[var(--text)]">Existencias</p>
        <p className="mt-2 text-sm text-[var(--text-soft)]">Los servicios no llevan stock.</p>
      </div>
    );
  }
  const sb = await createClient();
  const [stock, movements, { data: branches }] = await Promise.all([
    getProductStock(sb, productId),
    listMovements(sb, productId, { limit: 10 }),
    sb.from("branches").select("id, name").order("is_main", { ascending: false }),
  ]);
  const isBackOffice = ["owner", "admin", "administrativo"].includes(role);

  return (
    <div className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold text-[var(--text)]">Existencias <span className="text-xs font-normal text-[var(--text-soft)]">(mín. {stock.minStock})</span></p>
        {canManageStock(role) && (
          <StockAdjustForm productId={productId} branches={(branches ?? []) as any} userBranchId={userBranchId} isBackOffice={isBackOffice} />
        )}
      </div>
      {stock.levels.length === 0 ? (
        <p className="text-sm text-[var(--text-soft)]">Sin existencias registradas.</p>
      ) : (
        <ul className="space-y-1">
          {stock.levels.map((l) => (
            <li key={l.branchId} className="flex items-center justify-between text-sm">
              <span className="text-[var(--text)]">{l.branchName ?? "—"}</span>
              <span className={`font-semibold ${l.qty <= 0 ? "text-[#dc2626]" : "text-[var(--text)]"}`}>{l.qty}</span>
            </li>
          ))}
        </ul>
      )}
      <div>
        <p className="mb-1 text-xs font-medium text-[var(--text-soft)]">Últimos movimientos</p>
        <MovementsHistory movements={movements} />
      </div>
    </div>
  );
}
