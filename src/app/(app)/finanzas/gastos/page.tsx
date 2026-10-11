import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Receipt, Repeat, TrendingDown, CalendarClock, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  listExpenses, listExpenseCategories, listRecurring, expensesByCategory,
  upcomingRecurring, EXPENSES_SORT,
} from "@/lib/gastos/queries";
import { canSeeExpenses, canManageExpenses, canDeleteExpense } from "@/lib/gastos/permissions";
import { resolveSort } from "@/lib/sorting";
import { getTenantSettings } from "@/lib/tenant";
import { todayISO, isDateISO } from "@/lib/tz";
import { monthRange } from "@/lib/reportes/ranges";
import { formatMoney } from "@/lib/format";
import { ExpensesToolbar } from "@/components/gastos/expenses-toolbar";
import { ExpensesTable, ExpenseRowCard, EXPENSE_COL_WIDTHS } from "@/components/gastos/expenses-table";
import { RecurringList } from "@/components/gastos/recurring-list";
import { EmptyState } from "@/components/shared/empty-state";
import { buttonCls } from "@/components/ui/button";
import { ModuleHeader } from "@/components/shared/module-header";
import { ModuleGuide } from "@/components/shared/module-guide";
import { Page } from "@/components/shared/page";
import { Pagination } from "@/components/shared/pagination";
import { ListBox } from "@/components/shared/list-box";
import { Loading, TableSkeleton } from "@/components/ui/skeleton";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { GUIDES } from "@/lib/guides";
import { payRecurringAction, setRecurringActiveAction, deleteRecurringAction } from "./actions";
import type { Role } from "@/lib/auth/roles";

type Params = {
  q?: string; category?: string; from?: string; to?: string;
  page?: string; sort?: string; dir?: string; ver?: string;
};

export default async function GastosPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  const { data: mem } = await sb.from("memberships").select("role").eq("user_id", user!.id).single();
  const role = (mem?.role ?? "vendedor") as Role;
  if (!canSeeExpenses(role)) redirect("/dashboard");

  const { timezone: tz } = await getTenantSettings(sb);
  const hoy = todayISO(tz);
  const def = monthRange(new Date(), tz);
  // Si cualquiera de los dos extremos no sirve, manda el mes completo: nunca medio rango.
  const { from, to } = isDateISO(sp.from) && isDateISO(sp.to) ? { from: sp.from, to: sp.to } : def;
  const fijos = sp.ver === "fijos";
  const categories = await listExpenseCategories(sb);

  return (
    <Page>
      <ModuleHeader module="gastos" actions={canManageExpenses(role) ? (<>
        <Link href="/finanzas/gastos/importar" className={buttonCls("secondary")} aria-label="Importar gastos">
          <Upload className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          <span className="hidden xl:inline">Importar</span>
        </Link>
        <Link href="/finanzas/gastos/fijos/nuevo" className={buttonCls("secondary")}>
          <Repeat className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          <span className="hidden sm:inline">Nuevo fijo</span>
        </Link>
        <Link href="/finanzas/gastos/nuevo" className={buttonCls("primary")}>
          <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" /> Nuevo gasto
        </Link>
      </>) : undefined} />

      <Pestanas fijos={fijos} sp={sp} />

      {fijos ? (
        <Suspense fallback={<Loading><TableSkeleton widths={["40%", "25%", "20%", "15%"]} rows={4} /></Loading>}>
          <Fijos role={role} hoy={hoy} />
        </Suspense>
      ) : (<>
        <ExpensesToolbar categories={categories} today={hoy} from={from} to={to} />
        <Suspense key={`${sp.q}|${sp.category}|${from}|${to}|${sp.sort}|${sp.dir}|${sp.page}`}
          fallback={<Loading><TableSkeleton widths={EXPENSE_COL_WIDTHS} /></Loading>}>
          <Movimientos sp={sp} role={role} from={from} to={to} hoy={hoy} />
        </Suspense>
      </>)}
    </Page>
  );
}

function Pestanas({ fijos, sp }: { fijos: boolean; sp: Params }) {
  const href = (ver?: string) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (v && k !== "ver" && k !== "page") p.set(k, v);
    if (ver) p.set("ver", ver);
    const q = p.toString();
    return `/finanzas/gastos${q ? `?${q}` : ""}`;
  };
  const cls = (on: boolean) =>
    `inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium transition-colors ${
      on ? "bg-[#0e7490] text-white" : "border border-[var(--border)] text-[var(--text)] hover:bg-[var(--bg)]"}`;
  return (
    <nav aria-label="Qué gastos ver" className="flex gap-2">
      <Link href={href()} aria-current={!fijos ? "page" : undefined} className={cls(!fijos)}>Movimientos</Link>
      <Link href={href("fijos")} aria-current={fijos ? "page" : undefined} className={cls(fijos)}>Fijos</Link>
    </nav>
  );
}

async function Movimientos({ sp, role, from, to, hoy }: {
  sp: Params; role: Role; from: string; to: string; hoy: string;
}) {
  const sb = await createClient();
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const sort = resolveSort(EXPENSES_SORT, sp.sort, sp.dir);
  const { currency } = await getTenantSettings(sb);

  const [list, porCategoria, proximos] = await Promise.all([
    listExpenses(sb, {
      search: sp.q ?? "", categoryId: sp.category || null, range: { from, to },
      page, sort: sp.sort, dir: sp.dir,
    }),
    expensesByCategory(sb, { from, to }),
    upcomingRecurring(sb, hoy),
  ]);
  const pages = Math.max(1, Math.ceil(list.total / list.pageSize));
  const mayor = porCategoria[0];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <KpiCard icon={TrendingDown} label="Gastos del período"
          value={list.suma > 0 ? formatMoney(list.suma, currency) : undefined}
          sub={list.suma > 0 ? `${list.total} ${list.total === 1 ? "movimiento" : "movimientos"}` : undefined} />
        <KpiCard icon={Receipt} label="Mayor categoría"
          value={mayor ? formatMoney(mayor.total, currency) : undefined}
          sub={mayor ? mayor.name : undefined} />
        <KpiCard icon={CalendarClock} label="Fijos por pagar"
          value={proximos.total > 0 ? formatMoney(proximos.total, currency) : undefined}
          sub={proximos.total > 0
            ? proximos.vencidos > 0 ? `${proximos.vencidos} ya vencido${proximos.vencidos === 1 ? "" : "s"}` : "en los próximos 7 días"
            : undefined} />
      </div>

      {list.rows.length === 0 ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
          <EmptyState icon={Receipt} title="Sin gastos en este período"
            hint="Registra lo que sale del negocio y el inicio te dirá la utilidad real, no solo la bruta."
            action={canManageExpenses(role) ? { href: "/finanzas/gastos/nuevo", label: "Nuevo gasto" } : undefined}
            secondary={canManageExpenses(role)
              ? <Link href="/finanzas/gastos/importar" className={buttonCls("secondary")}>
                  <Upload className="h-4 w-4" strokeWidth={2} aria-hidden="true" /> Importar desde Excel
                </Link>
              : <ModuleGuide guide={GUIDES.gastos} />} />
        </div>
      ) : (<>
        <ListBox>
          <ExpensesTable rows={list.rows} currency={currency} sort={sort} puedeEditar={canManageExpenses(role)} />
          <div className="space-y-2 lg:hidden">
            {list.rows.map((r) => <ExpenseRowCard key={r.id} r={r} currency={currency} puedeEditar={canManageExpenses(role)} />)}
          </div>
        </ListBox>
        <Pagination basePath="/finanzas/gastos" params={sp} page={page} pages={pages} />

        {porCategoria.length > 1 && (
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <h2 className="mb-3 text-sm font-bold text-[var(--text)]">En qué se fue el dinero</h2>
            <ul className="space-y-2">
              {porCategoria.map((c) => {
                const pct = list.suma > 0 ? Math.round((c.total / list.suma) * 100) : 0;
                return (
                  <li key={c.categoryId ?? "none"} className="flex items-center gap-3 text-sm">
                    <span className="w-40 shrink-0 truncate text-[var(--text)]">{c.name}</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--bg)]">
                      <span className="block h-full rounded-full bg-[#0e7490] dark:bg-[#5eead4]" style={{ width: `${pct}%` }} />
                    </span>
                    <span className="w-12 shrink-0 text-right text-xs tabular-nums text-[var(--text-soft)]">{pct}%</span>
                    <span className="w-28 shrink-0 text-right font-medium tabular-nums text-[var(--text)]">{formatMoney(c.total, currency)}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </>)}
    </div>
  );
}

async function Fijos({ role, hoy }: { role: Role; hoy: string }) {
  const sb = await createClient();
  const [rows, { currency }] = await Promise.all([
    listRecurring(sb, { includeInactive: true }),
    getTenantSettings(sb),
  ]);

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        <EmptyState icon={Repeat} title="Sin gastos fijos"
          hint="El alquiler, la nómina y el internet se pagan siempre. Créalos una vez y te avisamos cuando toque."
          action={canManageExpenses(role) ? { href: "/finanzas/gastos/fijos/nuevo", label: "Nuevo fijo" } : undefined}
          secondary={<ModuleGuide guide={GUIDES.gastos} />} />
      </div>
    );
  }

  return (
    <ListBox>
      <RecurringList rows={rows} currency={currency} hoy={hoy}
        puedeEditar={canManageExpenses(role)} puedeBorrar={canDeleteExpense(role)}
        onPay={payRecurringAction} onToggle={setRecurringActiveAction} onDelete={deleteRecurringAction} />
    </ListBox>
  );
}
