import { Suspense } from "react";
import Link from "next/link";
import { Plus, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { listQuotes, QUOTES_SORT, type QuoteStatusFilter } from "@/lib/presupuestos/queries";
import { canSell } from "@/lib/ventas/permissions";
import { resolveSort } from "@/lib/sorting";
import { QuotesToolbar } from "@/components/presupuestos/quotes-toolbar";
import { QuotesTable, QUOTE_COL_WIDTHS } from "@/components/presupuestos/quotes-table";
import { QuoteRowCard } from "@/components/presupuestos/quote-row-card";
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

type Params = { q?: string; status?: string; page?: string; sort?: string; dir?: string };

export default async function PresupuestosPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  const { data: mem } = await sb.from("memberships").select("role").eq("user_id", user!.id).single();
  const role = (mem?.role ?? "vendedor") as Role;

  return (
    <Page>
      <ModuleHeader module="presupuestos" actions={canSell(role) ? (
        <Link href="/operaciones/presupuestos/nueva" className={buttonCls("primary")}>
          <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" /> Nuevo presupuesto
        </Link>
      ) : undefined} />

      <QuotesToolbar />

      <Suspense key={`${sp.q}|${sp.status}|${sp.sort}|${sp.dir}|${sp.page}`}
        fallback={<Loading><TableSkeleton widths={QUOTE_COL_WIDTHS} /></Loading>}>
        <QuotesList sp={sp} role={role} />
      </Suspense>
    </Page>
  );
}

async function QuotesList({ sp, role }: { sp: Params; role: Role }) {
  const sb = await createClient();
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const status = (["borradores", "enviados", "aceptados", "rechazados", "convertidos", "todos"].includes(sp.status ?? "") ? sp.status : "todos") as QuoteStatusFilter;
  const sort = resolveSort(QUOTES_SORT, sp.sort, sp.dir);

  const [list, { timezone: tz }] = await Promise.all([
    listQuotes(sb, { search: sp.q ?? "", status, page, sort: sp.sort, dir: sp.dir }),
    getTenantSettings(sb),
  ]);
  const pages = Math.max(1, Math.ceil(list.total / list.pageSize));

  if (list.rows.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        <EmptyState icon={FileText} title="Sin presupuestos"
          hint="Cotiza sin tocar stock ni numeración de ventas."
          action={canSell(role) ? { href: "/operaciones/presupuestos/nueva", label: "Nuevo presupuesto" } : undefined}
          secondary={<ModuleGuide guide={GUIDES.presupuestos} />} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ListBox>
        <QuotesTable rows={list.rows} tz={tz} today={todayISO(tz)} sort={sort} />
        <div className="space-y-2 lg:hidden">{list.rows.map((r) => <QuoteRowCard key={r.id} r={r} />)}</div>
      </ListBox>
      <Pagination basePath="/operaciones/presupuestos" params={sp} page={page} pages={pages} />
    </div>
  );
}
