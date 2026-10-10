import { redirect } from "next/navigation";
import { Boxes } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getTenantCurrency } from "@/lib/productos/queries";
import { inventoryValuation } from "@/lib/inventario/queries";
import { canAccess, type Role } from "@/lib/auth/roles";
import { formatMoney } from "@/lib/format";
import { EmptyState } from "@/components/shared/empty-state";
import { ModuleHeader } from "@/components/shared/module-header";
import { ModuleGuide } from "@/components/shared/module-guide";
import { GUIDES } from "@/lib/guides";
import { Page } from "@/components/shared/page";

export default async function ReporteInventarioPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  const { data: mem } = await sb.from("memberships").select("role").eq("user_id", user!.id).single();
  const role = (mem?.role ?? "vendedor") as Role;
  if (!canAccess(role, "reportes")) redirect("/dashboard");

  const [val, currency] = await Promise.all([inventoryValuation(sb, {}), getTenantCurrency(sb)]);

  return (
    <Page>
      <ModuleHeader module="reportes_inventario" actions={
        <div className="text-sm text-[var(--text-soft)]">Total: <span className="font-semibold text-[var(--text)]">{formatMoney(val.total, currency)}</span></div>} />

      {val.rows.length === 0 ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
          <EmptyState icon={Boxes} title="Carga existencias para ver el valor"
            hint="El valor es existencia × costo de cada producto."
            secondary={<ModuleGuide guide={GUIDES.reportes_inventario} />} />
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-2 lg:p-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--text-soft)]">
                <th className="py-2 font-medium">Producto</th><th className="font-medium">Sucursal</th>
                <th className="font-medium">Existencia</th><th className="font-medium">Costo</th><th className="font-medium">Valor</th>
              </tr>
            </thead>
            <tbody>
              {val.rows.map((r, i) => (
                <tr key={`${r.productId}-${i}`} className="border-b border-[var(--border)]">
                  <td className="py-2 text-[var(--text)]">{r.name}</td>
                  <td className="text-[var(--text-soft)]">{r.branchName ?? "—"}</td>
                  <td className="text-[var(--text)]">{r.qty}</td>
                  <td className="text-[var(--text-soft)]">{formatMoney(r.cost, currency)}</td>
                  <td className="font-medium text-[var(--text)]">{formatMoney(r.value, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Page>
  );
}
