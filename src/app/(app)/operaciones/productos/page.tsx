import Link from "next/link";
import { Plus, Package } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { listProducts, listCategories, getTenantCurrency, type ProductStatus } from "@/lib/productos/queries";
import { canManageProducts } from "@/lib/productos/permissions";
import { ProductsToolbar } from "@/components/productos/products-toolbar";
import { ProductsTable } from "@/components/productos/products-table";
import { ProductRowCard } from "@/components/productos/product-row-card";
import { EmptyState } from "@/components/shared/empty-state";
import type { Role } from "@/lib/auth/roles";

export default async function ProductosPage({ searchParams }: {
  searchParams: Promise<{ q?: string; category?: string; kind?: string; status?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  const { data: mem } = await sb.from("memberships").select("role").eq("user_id", user!.id).single();
  const role = (mem?.role ?? "vendedor") as Role;
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const status = (["activos", "archivados", "todos"].includes(sp.status ?? "") ? sp.status : "activos") as ProductStatus;
  const kind = (["good", "service"].includes(sp.kind ?? "") ? sp.kind : null) as "good" | "service" | null;

  const [categories, currency, list] = await Promise.all([
    listCategories(sb),
    getTenantCurrency(sb),
    listProducts(sb, { search: sp.q ?? "", categoryId: sp.category || null, kind, status, page }),
  ]);
  const pages = Math.max(1, Math.ceil(list.total / list.pageSize));

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold tracking-[-0.4px] text-[var(--text)]">Productos</h1>
        {canManageProducts(role) && (
          <Link href="/operaciones/productos/nuevo"
            className="flex items-center gap-1.5 rounded-[10px] bg-gradient-to-br from-[#0e7490] to-[#14b8a6] px-3 py-2 text-sm font-semibold text-white">
            <Plus className="h-4 w-4" strokeWidth={2.5} /> Nuevo producto
          </Link>
        )}
      </div>

      <ProductsToolbar categories={categories} />

      {list.rows.length === 0 ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
          <EmptyState icon={Package} title="Aún no tienes productos" hint={"Crea el primero con “Nuevo producto”."} />
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-2 lg:p-4">
          <ProductsTable rows={list.rows} currency={currency} />
          <div className="space-y-2 lg:hidden">{list.rows.map((r) => <ProductRowCard key={r.id} r={r} currency={currency} />)}</div>
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
  if (sp.q) params.set("q", sp.q); if (sp.category) params.set("category", sp.category);
  if (sp.kind) params.set("kind", sp.kind); if (sp.status) params.set("status", sp.status);
  params.set("page", String(page));
  return <Link href={`/operaciones/productos?${params.toString()}`} className="rounded px-2 text-[var(--text)] hover:bg-[var(--bg)]">{children}</Link>;
}
