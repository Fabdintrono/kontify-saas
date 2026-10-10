import { Suspense } from "react";
import Link from "next/link";
import { Plus, Package } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { listProducts, listCategories, getTenantCurrency, PRODUCTS_SORT, type ProductStatus } from "@/lib/productos/queries";
import { canManageProducts } from "@/lib/productos/permissions";
import { resolveSort } from "@/lib/sorting";
import { ProductsToolbar } from "@/components/productos/products-toolbar";
import { ProductsTable, PRODUCT_COL_WIDTHS } from "@/components/productos/products-table";
import { ProductRowCard } from "@/components/productos/product-row-card";
import { EmptyState } from "@/components/shared/empty-state";
import { buttonCls } from "@/components/ui/button";
import { ModuleHeader } from "@/components/shared/module-header";
import { ModuleGuide } from "@/components/shared/module-guide";
import { Page } from "@/components/shared/page";
import { Pagination } from "@/components/shared/pagination";
import { ListBox } from "@/components/shared/list-box";
import { Loading, TableSkeleton } from "@/components/ui/skeleton";
import { GUIDES } from "@/lib/guides";
import type { Role } from "@/lib/auth/roles";

type Params = { q?: string; category?: string; kind?: string; status?: string; page?: string; sort?: string; dir?: string };

export default async function ProductosPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  const { data: mem } = await sb.from("memberships").select("role").eq("user_id", user!.id).single();
  const role = (mem?.role ?? "vendedor") as Role;
  const categories = await listCategories(sb);

  return (
    <Page>
      <ModuleHeader module="productos" actions={canManageProducts(role) ? (
        <Link href="/operaciones/productos/nuevo" className={buttonCls("primary")}>
          <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" /> Nuevo producto
        </Link>
      ) : undefined} />

      <ProductsToolbar categories={categories} />

      <Suspense key={`${sp.q}|${sp.category}|${sp.kind}|${sp.status}|${sp.sort}|${sp.dir}|${sp.page}`}
        fallback={<Loading><TableSkeleton widths={PRODUCT_COL_WIDTHS} /></Loading>}>
        <ProductsList sp={sp} role={role} />
      </Suspense>
    </Page>
  );
}

async function ProductsList({ sp, role }: { sp: Params; role: Role }) {
  const sb = await createClient();
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const status = (["activos", "archivados", "todos"].includes(sp.status ?? "") ? sp.status : "activos") as ProductStatus;
  const kind = (["good", "service"].includes(sp.kind ?? "") ? sp.kind : null) as "good" | "service" | null;
  const sort = resolveSort(PRODUCTS_SORT, sp.sort, sp.dir);

  const [currency, list] = await Promise.all([
    getTenantCurrency(sb),
    listProducts(sb, { search: sp.q ?? "", categoryId: sp.category || null, kind, status, page, sort: sp.sort, dir: sp.dir }),
  ]);
  const pages = Math.max(1, Math.ceil(list.total / list.pageSize));

  if (list.rows.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        <EmptyState icon={Package} title="Tu catálogo está vacío"
          hint="Crea bienes (con stock) o servicios (sin stock)."
          action={canManageProducts(role) ? { href: "/operaciones/productos/nuevo", label: "Nuevo producto" } : undefined}
          secondary={<ModuleGuide guide={GUIDES.productos} />} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ListBox>
        <ProductsTable rows={list.rows} currency={currency} sort={sort} />
        <div className="space-y-2 lg:hidden">{list.rows.map((r) => <ProductRowCard key={r.id} r={r} currency={currency} />)}</div>
      </ListBox>
      <Pagination basePath="/operaciones/productos" params={sp} page={page} pages={pages} />
    </div>
  );
}
