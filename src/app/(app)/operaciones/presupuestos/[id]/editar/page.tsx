import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTenantCurrency } from "@/lib/productos/queries";
import { listActiveClientsLite, listActiveProductsLite, listBranches } from "@/lib/ventas/queries";
import { getQuote } from "@/lib/presupuestos/queries";
import { canSell } from "@/lib/ventas/permissions";
import { QuoteBuilder } from "@/components/presupuestos/quote-builder";
import type { Role } from "@/lib/auth/roles";

export default async function EditarPresupuestoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  const { data: mem } = await sb.from("memberships").select("role, branch_id").eq("user_id", user!.id).single();
  const role = (mem?.role ?? "vendedor") as Role;
  if (!canSell(role)) redirect("/dashboard");

  const [quote, clients, products, branches, currency] = await Promise.all([
    getQuote(sb, id), listActiveClientsLite(sb), listActiveProductsLite(sb), listBranches(sb), getTenantCurrency(sb),
  ]);
  if (!quote) notFound();
  if (quote.status !== "draft") redirect(`/operaciones/presupuestos/${id}`);

  const items = (quote.items as any[]).map((it) => ({
    productId: it.product_id ?? null, description: it.description, quantity: Number(it.quantity),
    unitPrice: Number(it.unit_price), discountPct: Number(it.discount_pct), taxRate: Number(it.tax_rate),
  }));

  return (
    <div className="p-6">
      <h1 className="mb-4 text-xl font-extrabold tracking-[-0.4px] text-[var(--text)]">Editar presupuesto</h1>
      <QuoteBuilder clients={clients} products={products} branches={branches}
        role={role} userBranchId={mem?.branch_id ?? null} currency={currency}
        values={{ id: quote.id, clientId: quote.client_id, branchId: quote.branch_id,
          globalDiscountPct: Number(quote.global_discount_pct), validUntil: quote.valid_until ?? "",
          notes: quote.notes ?? "", items }} />
    </div>
  );
}
