import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getProduct } from "@/lib/productos/queries";
import { canManageProducts, canArchiveProduct } from "@/lib/productos/permissions";
import { archiveProductAction } from "@/app/(app)/operaciones/productos/actions";
import { ProductStockPanel } from "@/components/inventario/product-stock-panel";
import { CategoryBadge } from "@/components/productos/category-badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ActionButton } from "@/components/ui/action-button";
import { flashFor } from "@/lib/flash";
import { formatMoney } from "@/lib/format";
import { getTenantSettings } from "@/lib/tenant";
import type { Role } from "@/lib/auth/roles";

export default async function ProductoDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createClient();
  const [p, { currency, timezone: tz }] = await Promise.all([getProduct(sb, id), getTenantSettings(sb)]);
  if (!p) notFound();
  const { data: { user } } = await sb.auth.getUser();
  const { data: mem } = await sb.from("memberships").select("role, branch_id").eq("user_id", user!.id).single();
  const role = (mem?.role ?? "vendedor") as Role;

  const margin = p.cost != null && p.price != null ? Number(p.price) - Number(p.cost) : null;
  const field = (label: string, value: string | null) => (
    <div><p className="text-xs text-[var(--text-soft)]">{label}</p><p className="text-sm text-[var(--text)]">{value || "—"}</p></div>
  );
  const secondaryBtn = "rounded-[10px] border border-[var(--border)] px-3 py-2 text-sm text-[var(--text)]";

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-extrabold tracking-[-0.4px] text-[var(--text)]">{p.name}</h1>
          <CategoryBadge name={p.product_categories?.name ?? null} />
          {!p.active && <span className="rounded-full bg-[var(--bg)] px-2 py-0.5 text-xs text-[var(--text-soft)]">Archivado</span>}
        </div>
        <div className="flex items-center gap-2">
          {canManageProducts(role) && (
            <Link href={`/operaciones/productos/${p.id}/editar`}
              className="flex items-center gap-1.5 rounded-[10px] border border-[var(--border)] px-3 py-2 text-sm text-[var(--text)]">
              <Pencil className="h-4 w-4" /> Editar
            </Link>
          )}
          {canArchiveProduct(role) && (p.active ? (
            <ConfirmDialog action={archiveProductAction} payload={{ id: p.id, active: "false" }}
              title={`¿Archivar ${p.name}?`}
              description="Deja de aparecer en el catálogo y al vender. Sus existencias y movimientos se conservan."
              confirmLabel="Archivar" tone="primary" successToast={flashFor("producto-archivado")} triggerClassName={secondaryBtn}>
              Archivar
            </ConfirmDialog>
          ) : (
            <ActionButton action={archiveProductAction} payload={{ id: p.id, active: "true" }}
              successToast={flashFor("producto-reactivado")} pendingLabel="Reactivando…" className={secondaryBtn}>
              Reactivar
            </ActionButton>
          ))}
        </div>
      </div>

      <div className="grid gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:grid-cols-2">
        {field("Tipo", p.kind === "service" ? "Servicio" : "Bien")}
        {field("SKU / código", p.sku)}
        {field("Precio", formatMoney(p.price, currency))}
        {canManageProducts(role) && field("Costo", p.cost != null ? formatMoney(p.cost, currency) : null)}
        {canManageProducts(role) && field("Margen", margin != null ? formatMoney(margin, currency) : null)}
        {field("Impuesto", p.tax_rates ? `${p.tax_rates.name} (${Number(p.tax_rates.rate)}%)` : null)}
        {field("Unidad", p.unit)}
        <div className="sm:col-span-2">{field("Descripción", p.description)}</div>
      </div>

      <ProductStockPanel productId={p.id} kind={p.kind} role={role} userBranchId={mem?.branch_id ?? null} tz={tz} />
    </div>
  );
}
