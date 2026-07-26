import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTenantCurrency } from "@/lib/productos/queries";
import { listActiveClientsLite, listActiveProductsLite, listBranches } from "@/lib/ventas/queries";
import { canSell } from "@/lib/ventas/permissions";
import { SaleBuilder } from "@/components/ventas/sale-builder";
import type { Role } from "@/lib/auth/roles";

export default async function NuevaVentaPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  const { data: mem } = await sb.from("memberships").select("role, branch_id").eq("user_id", user!.id).single();
  const role = (mem?.role ?? "vendedor") as Role;
  if (!canSell(role)) redirect("/dashboard");

  const [clients, products, branches, currency] = await Promise.all([
    listActiveClientsLite(sb), listActiveProductsLite(sb), listBranches(sb), getTenantCurrency(sb),
  ]);

  return (
    <div className="p-6">
      <h1 className="mb-4 text-xl font-extrabold tracking-[-0.4px] text-[var(--text)]">Nueva venta</h1>
      <SaleBuilder clients={clients} products={products} branches={branches}
        role={role} userBranchId={mem?.branch_id ?? null} currency={currency} />
    </div>
  );
}
