import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTenantCurrency } from "@/lib/productos/queries";
import { getSale, listActiveClientsLite, listActiveProductsLite, listBranches } from "@/lib/ventas/queries";
import { canSell } from "@/lib/ventas/permissions";
import { SaleBuilder } from "@/components/ventas/sale-builder";
import type { Role } from "@/lib/auth/roles";

export default async function EditarVentaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  const { data: mem } = await sb.from("memberships").select("role, branch_id").eq("user_id", user!.id).single();
  const role = (mem?.role ?? "vendedor") as Role;
  if (!canSell(role)) redirect("/dashboard");

  const [sale, clients, products, branches, currency] = await Promise.all([
    getSale(sb, id), listActiveClientsLite(sb), listActiveProductsLite(sb), listBranches(sb), getTenantCurrency(sb),
  ]);
  if (!sale) notFound();
  if (sale.status !== "draft") redirect(`/operaciones/facturacion/${id}`);

  const items = (sale.items as any[]).map((it) => ({
    productId: it.product_id ?? null, description: it.description, quantity: Number(it.quantity),
    unitPrice: Number(it.unit_price), discountPct: Number(it.discount_pct), taxRate: Number(it.tax_rate),
  }));

  return (
    <div className="p-6">
      <h1 className="mb-4 text-xl font-extrabold tracking-[-0.4px] text-[var(--text)]">Editar borrador</h1>
      <SaleBuilder clients={clients} products={products} branches={branches}
        role={role} userBranchId={mem?.branch_id ?? null} currency={currency}
        values={{ id: sale.id, clientId: sale.client_id, branchId: sale.branch_id,
          globalDiscountPct: Number(sale.global_discount_pct), notes: sale.notes ?? "", items }} />
    </div>
  );
}
