import { createClient } from "@/lib/supabase/server";
import { DollarSign, TrendingUp, TrendingDown, Users, ArrowDownCircle, ArrowUpCircle, Receipt, AlertTriangle } from "lucide-react";
import { KpiCard, TrendChip } from "@/components/dashboard/kpi-card";
import { AttentionList } from "@/components/dashboard/attention-list";
import { clientsKpi, clientsByType } from "@/lib/clientes/queries";
import { productsKpi, productsByCategory } from "@/lib/productos/queries";
import { salesKpi, receivablesTotal } from "@/lib/ventas/queries";
import { stockKpi, inventoryStatusBreakdown } from "@/lib/inventario/queries";
import { canManageProducts } from "@/lib/productos/permissions";
import { canRegisterPayment } from "@/lib/cobros/permissions";
import type { Role } from "@/lib/auth/roles";
import { formatMoney, weekdayShort } from "@/lib/format";
import { utilityThisMonth, salesByDayThisWeek, topProductsThisMonth } from "@/lib/reportes/queries";
import { getTenantSettings } from "@/lib/tenant";
import { todayISO } from "@/lib/tz";
import { attentionItems } from "@/lib/dashboard/attention";
import { expensesKpi, upcomingRecurring } from "@/lib/gastos/queries";
import { canSeeExpenses } from "@/lib/gastos/permissions";
import { dashboardTrends } from "@/lib/dashboard/trends";
import { gettingStartedStatus, canSeeGettingStarted, canHideGettingStarted } from "@/lib/dashboard/getting-started";
import { BarChart } from "@/components/reportes/bar-chart";
import { ModuleGuide } from "@/components/shared/module-guide";
import { GUIDES } from "@/lib/guides";
import { Page } from "@/components/shared/page";
import { GettingStarted } from "@/components/dashboard/getting-started";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { hideGettingStartedAction } from "./actions";
import { DANGER_TEXT } from "@/lib/ui-tokens";

export default async function Dashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("full_name").eq("id", user.id).single()
    : { data: null };
  const firstName = ((profile?.full_name ?? "") as string).split(" ")[0] || "";
  const { data: mem } = user ? await supabase.from("memberships").select("role").eq("user_id", user.id).single() : { data: null };
  const role = (mem?.role ?? "vendedor") as Role;

  const { currency, timezone: tz } = await getTenantSettings(supabase);
  const [kpi, byType, prodKpi, byCategory, sKpi, recv] = await Promise.all([
    clientsKpi(supabase, tz), clientsByType(supabase), productsKpi(supabase), productsByCategory(supabase),
    salesKpi(supabase, tz), receivablesTotal(supabase),
  ]);
  const [invKpi, invBreakdown] = await Promise.all([stockKpi(supabase), inventoryStatusBreakdown(supabase)]);
  const [util, weekDays, topProds, attention, trends, gastos, porPagar, gs] = await Promise.all([
    utilityThisMonth(supabase, tz), salesByDayThisWeek(supabase, tz), topProductsThisMonth(supabase, tz, 5),
    attentionItems(supabase, todayISO(tz)),
    dashboardTrends(supabase, tz),
    // Los gastos son del back-office: a quien no puede verlos no se le consultan.
    canSeeExpenses(role) ? expensesKpi(supabase, tz) : Promise.resolve({ mes: 0, tramoAnterior: 0 }),
    canSeeExpenses(role) ? upcomingRecurring(supabase, todayISO(tz)) : Promise.resolve({ total: 0, vencidos: 0, filas: [] }),
    // Solo dueño/admin ven «Primeros pasos»: para el resto no se consulta.
    canSeeGettingStarted(role) ? gettingStartedStatus(supabase) : Promise.resolve(null),
  ]);
  const weekBars = weekDays.map((d) => ({ label: weekdayShort(d.date), value: d.revenue }));
  const bajoStock = (invKpi.lowCount + invKpi.outCount) > 0 ? { value: String(invKpi.lowCount + invKpi.outCount) } : {};
  const ventasMes = sKpi.monthTotal > 0 ? { value: formatMoney(sKpi.monthTotal, currency) } : {};
  const ticket = sKpi.avgTicket > 0 ? { value: formatMoney(sKpi.avgTicket, currency) } : {};
  const porCobrar = recv.total > 0 ? { value: formatMoney(recv.total, currency) } : {};
  const dinero = (n: number) => formatMoney(n, currency);

  // Utilidad neta = lo que queda después de restar los gastos a la utilidad bruta.
  // Es la cifra que de verdad dice si el mes va bien; la bruta sola engaña.
  const verGastos = canSeeExpenses(role) && canManageProducts(role);
  const utilidadNeta = verGastos && sKpi.monthTotal > 0
    ? { value: formatMoney(util.utility - gastos.mes, currency) }
    : {};
  const gastosMes = canSeeExpenses(role) && gastos.mes > 0 ? { value: formatMoney(gastos.mes, currency) } : {};
  const porPagarValor = porPagar.total > 0 ? { value: formatMoney(porPagar.total, currency) } : {};
  const totalClientes = kpi.total > 0
    ? { value: String(kpi.total), sub: `${kpi.newThisMonth} nuevos este mes` }
    : {};

  return (
    <Page>
      {/* Misma estructura que ModuleHeader: la ayuda en el mismo sitio que en los demás módulos. */}
      <div className="space-y-1.5">
        <div className="flex items-start justify-between gap-3">
          <h1 className="min-w-0 flex-1 text-xl font-extrabold tracking-[-0.4px] text-[var(--text)]">
            Hola{firstName ? `, ${firstName}` : ""} 👋
          </h1>
          <div className="flex shrink-0 items-center gap-2"><ModuleGuide guide={GUIDES.dashboard} variant="button" /></div>
        </div>
        <p className="max-w-3xl text-sm text-[var(--text-soft)]">{GUIDES.dashboard.subtitle}</p>
      </div>

      {gs && <GettingStarted status={gs} canHide={canHideGettingStarted(role)} action={hideGettingStartedAction} />}

      <QuickActions role={role} />

      {/* Móvil: hero Utilidad + 4 KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:hidden">
        <div className="col-span-2">
          <KpiCard icon={TrendingUp} label="Utilidad neta del mes" value={utilidadNeta.value}
            sub={verGastos && utilidadNeta.value ? `${dinero(util.utility)} de utilidad bruta menos ${dinero(gastos.mes)} de gastos` : undefined} />
        </div>
        <KpiCard icon={DollarSign} label="Ventas del mes" value={ventasMes.value}
          trend={<TrendChip trend={trends.ventas} formato={dinero} />} />
        <KpiCard icon={TrendingDown} label="Gastos del mes" value={gastosMes.value} />
        <KpiCard icon={ArrowDownCircle} label="Por cobrar" value={porCobrar.value} />
        <KpiCard icon={ArrowUpCircle} label="Por pagar" value={porPagarValor.value} />
        <KpiCard icon={AlertTriangle} label="Bajo stock" value={bajoStock.value} />
      </div>

      {/* Escritorio: 4 KPIs primarios + 4 secundarios */}
      <div className="hidden grid-cols-4 gap-3 lg:grid">
        <KpiCard icon={DollarSign} label="Ventas del mes" value={ventasMes.value}
          trend={<TrendChip trend={trends.ventas} formato={dinero} />} />
        <KpiCard icon={TrendingDown} label="Gastos del mes" value={gastosMes.value} />
        {/* La cifra que importa: bruta menos gastos. El subtítulo enseña la resta para
            que no haya que creérselo. */}
        <KpiCard icon={TrendingUp} label="Utilidad neta del mes" value={utilidadNeta.value}
          sub={verGastos && utilidadNeta.value ? `${dinero(util.utility)} bruta menos ${dinero(gastos.mes)} de gastos` : undefined} />
        {/* Sin comparación aquí: el número grande es el total acumulado y el porcentaje
            hablaría de las altas del mes. Comparar dos cosas distintas confunde más que ayuda. */}
        <KpiCard icon={Users} label="Total de clientes" value={totalClientes.value} sub={totalClientes.sub} />
        <KpiCard icon={ArrowDownCircle} label="Por cobrar" value={porCobrar.value} />
        <KpiCard icon={ArrowUpCircle} label="Por pagar" value={porPagarValor.value}
          sub={porPagar.total > 0 ? (porPagar.vencidos > 0 ? `${porPagar.vencidos} gasto fijo vencido` : "gastos fijos de los próximos 7 días") : undefined} />
        <KpiCard icon={Receipt} label="Ticket promedio" value={ticket.value}
          trend={<TrendChip trend={trends.ticket} formato={dinero} />} />
        <KpiCard icon={AlertTriangle} label="Bajo stock / agotados" value={bajoStock.value} />
      </div>

      {/* Escritorio: gráficos */}
      <div className="hidden gap-4 lg:grid lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="mb-3 text-sm font-bold text-[var(--text)]">Ventas de la semana</p>
          <BarChart data={weekBars} currency={currency} />
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="mb-3 text-sm font-bold text-[var(--text)]">Estado del inventario</p>
          {invBreakdown.inStock + invBreakdown.low + invBreakdown.out === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--text-soft)]">Aún no hay productos en inventario.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              <li className="flex items-center justify-between"><span className="text-[var(--text)]">En stock</span><span className="font-semibold text-[#0f766e] dark:text-[#6ee7b7]">{invBreakdown.inStock}</span></li>
              <li className="flex items-center justify-between"><span className="text-[var(--text)]">Bajo</span><span className="font-semibold text-[#b45309] dark:text-[#fbbf24]">{invBreakdown.low}</span></li>
              <li className="flex items-center justify-between"><span className="text-[var(--text)]">Agotado</span><span className={`font-semibold ${DANGER_TEXT}`}>{invBreakdown.out}</span></li>
            </ul>
          )}
        </div>
      </div>

      {/* Escritorio: Clientes por tipo + Productos por categoría */}
      <div className="hidden gap-4 lg:grid lg:grid-cols-3">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="mb-3 text-sm font-bold text-[var(--text)]">Clientes por tipo</p>
          {byType.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--text-soft)]">Aún sin clientes registrados.</p>
          ) : (
            <ul className="space-y-2">
              {byType.map((t) => (
                <li key={t.typeId ?? "none"} className="flex items-center justify-between text-sm">
                  <span className="text-[var(--text)]">{t.name}</span>
                  <span className="font-semibold text-[var(--text)]">{t.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-bold text-[var(--text)]">Productos por categoría</p>
            {prodKpi.total > 0 && <span className="text-sm font-semibold text-[var(--text-soft)]">{prodKpi.total} en total</span>}
          </div>
          {byCategory.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--text-soft)]">Aún sin productos registrados.</p>
          ) : (
            <ul className="space-y-2">
              {byCategory.map((c) => (
                <li key={c.categoryId ?? "none"} className="flex items-center justify-between text-sm">
                  <span className="text-[var(--text)]">{c.name}</span>
                  <span className="font-semibold text-[var(--text)]">{c.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="mb-3 text-sm font-bold text-[var(--text)]">Top productos</p>
          {topProds.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--text-soft)]">Aún sin ventas registradas.</p>
          ) : (
            <ul className="space-y-2">
              {topProds.map((p) => (
                <li key={p.productId ?? p.name} className="flex items-center justify-between text-sm">
                  <span className="truncate text-[var(--text)]">{p.name}</span>
                  <span className="font-semibold text-[var(--text)]">{formatMoney(p.revenue, currency)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <AttentionList items={attention} canSeeReceivables={canRegisterPayment(role)} />
    </Page>
  );
}
