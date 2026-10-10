import { Suspense } from "react";
import Link from "next/link";
import { Plus, ShoppingCart } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { listSales, SALES_SORT, type SaleStatusFilter, type SalePaymentFilter } from "@/lib/ventas/queries";
import { canSell } from "@/lib/ventas/permissions";
import { resolveSort } from "@/lib/sorting";
import { SalesToolbar } from "@/components/ventas/sales-toolbar";
import { SalesTable, SALE_COL_WIDTHS } from "@/components/ventas/sales-table";
import { SaleRowCard } from "@/components/ventas/sale-row-card";
import { EmptyState } from "@/components/shared/empty-state";
import { buttonCls } from "@/components/ui/button";
import { ModuleHeader } from "@/components/shared/module-header";
import { ModuleGuide } from "@/components/shared/module-guide";
import { Page } from "@/components/shared/page";
import { Pagination } from "@/components/shared/pagination";
import { ListBox } from "@/components/shared/list-box";
import { Loading, TableSkeleton } from "@/components/ui/skeleton";
import { GUIDES } from "@/lib/guides";
import { getTenantSettings } from "@/lib/tenant";
import { todayISO } from "@/lib/tz";
import type { Role } from "@/lib/auth/roles";

type Params = { q?: string; status?: string; payment?: string; page?: string; sort?: string; dir?: string };

export default async function FacturacionPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  const { data: mem } = await sb.from("memberships").select("role").eq("user_id", user!.id).single();
  const role = (mem?.role ?? "vendedor") as Role;

  return (
    <Page>
      <ModuleHeader module="ventas" actions={canSell(role) ? (
        <Link href="/operaciones/facturacion/nueva" className={buttonCls("primary")}>
          <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" /> Nueva venta
        </Link>
      ) : undefined} />

      <SalesToolbar />

      <Suspense key={`${sp.q}|${sp.status}|${sp.payment}|${sp.sort}|${sp.dir}|${sp.page}`}
        fallback={<Loading><TableSkeleton widths={SALE_COL_WIDTHS} /></Loading>}>
        <SalesList sp={sp} role={role} />
      </Suspense>
    </Page>
  );
}

async function SalesList({ sp, role }: { sp: Params; role: Role }) {
  const sb = await createClient();
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const status = (["borradores", "emitidas", "anuladas", "todas"].includes(sp.status ?? "") ? sp.status : "todas") as SaleStatusFilter;
  const payment = (["pendientes", "vencidas", "todas"].includes(sp.payment ?? "") ? sp.payment : "todas") as SalePaymentFilter;
  const sort = resolveSort(SALES_SORT, sp.sort, sp.dir);

  const { timezone: tz } = await getTenantSettings(sb);
  const list = await listSales(sb, { search: sp.q ?? "", status, payment, page, today: todayISO(tz), sort: sp.sort, dir: sp.dir });
  const pages = Math.max(1, Math.ceil(list.total / list.pageSize));

  if (list.rows.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        <EmptyState icon={ShoppingCart} title="Aún no hay ventas"
          hint="La primera venta puede ser a Consumidor final."
          action={canSell(role) ? { href: "/operaciones/facturacion/nueva", label: "Nueva venta" } : undefined}
          secondary={<ModuleGuide guide={GUIDES.ventas} />} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ListBox>
        <SalesTable rows={list.rows} tz={tz} sort={sort} />
        <div className="space-y-2 lg:hidden">{list.rows.map((r) => <SaleRowCard key={r.id} r={r} tz={tz} />)}</div>
      </ListBox>
      <Pagination basePath="/operaciones/facturacion" params={sp} page={page} pages={pages} />
    </div>
  );
}
