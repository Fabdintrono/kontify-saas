import { createClient } from "@/lib/supabase/server";
import { DollarSign, TrendingUp, Users, Boxes, ArrowDownCircle, ArrowUpCircle, Receipt, AlertTriangle, BarChart3, Package } from "lucide-react";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { ChartCard } from "@/components/dashboard/chart-card";
import { AttentionList } from "@/components/dashboard/attention-list";
import { PeriodSelector } from "@/components/dashboard/period-selector";
import { clientsKpi, clientsByType } from "@/lib/clientes/queries";
import { productsKpi, productsByCategory, getTenantCurrency } from "@/lib/productos/queries";
import { salesKpi, receivablesTotal } from "@/lib/ventas/queries";
import { stockKpi, inventoryStatusBreakdown } from "@/lib/inventario/queries";
import { canManageProducts } from "@/lib/productos/permissions";
import type { Role } from "@/lib/auth/roles";
import { formatMoney } from "@/lib/format";

export default async function Dashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("full_name").eq("id", user.id).single()
    : { data: null };
  const firstName = ((profile?.full_name ?? "") as string).split(" ")[0] || "";
  const { data: mem } = user ? await supabase.from("memberships").select("role").eq("user_id", user.id).single() : { data: null };
  const role = (mem?.role ?? "vendedor") as Role;

  const [kpi, byType, prodKpi, byCategory, sKpi, recv, currency] = await Promise.all([
    clientsKpi(supabase), clientsByType(supabase), productsKpi(supabase), productsByCategory(supabase),
    salesKpi(supabase), receivablesTotal(supabase), getTenantCurrency(supabase),
  ]);
  const [invKpi, invBreakdown] = await Promise.all([stockKpi(supabase), inventoryStatusBreakdown(supabase)]);
  const valorInventario = canManageProducts(role) && invKpi.value > 0 ? { value: formatMoney(invKpi.value, currency) } : {};
  const bajoStock = (invKpi.lowCount + invKpi.outCount) > 0 ? { value: String(invKpi.lowCount + invKpi.outCount) } : {};
  const ventasMes = sKpi.monthTotal > 0 ? { value: formatMoney(sKpi.monthTotal, currency) } : {};
  const ticket = sKpi.avgTicket > 0 ? { value: formatMoney(sKpi.avgTicket, currency) } : {};
  const porCobrar = recv.total > 0 ? { value: formatMoney(recv.total, currency) } : {};
  const totalProductos = prodKpi.total > 0 ? { value: String(prodKpi.total) } : {};
  const totalClientes = kpi.total > 0
    ? { value: String(kpi.total), sub: `${kpi.newThisMonth} nuevos este mes` }
    : {};

  return (
    <div className="space-y-5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-extrabold tracking-[-0.4px] text-[var(--text)]">
          Hola{firstName ? `, ${firstName}` : ""} 👋
        </h1>
        <PeriodSelector />
      </div>

      {/* Móvil: hero Utilidad + 4 KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:hidden">
        <div className="col-span-2"><KpiCard icon={TrendingUp} label="Utilidad del mes" /></div>
        <KpiCard icon={DollarSign} label="Ventas del mes" value={ventasMes.value} />
        <KpiCard icon={Users} label="Total de clientes" value={totalClientes.value} sub={totalClientes.sub} />
        <KpiCard icon={ArrowDownCircle} label="Por cobrar" value={porCobrar.value} />
        <KpiCard icon={AlertTriangle} label="Bajo stock" value={bajoStock.value} />
        <KpiCard icon={Package} label="Productos" value={totalProductos.value} />
      </div>

      {/* Escritorio: 4 KPIs primarios + 4 secundarios */}
      <div className="hidden grid-cols-4 gap-3 lg:grid">
        <KpiCard icon={DollarSign} label="Ventas del mes" value={ventasMes.value} />
        <KpiCard icon={TrendingUp} label="Utilidad del mes" />
        <KpiCard icon={Users} label="Total de clientes" value={totalClientes.value} sub={totalClientes.sub} />
        <KpiCard icon={Boxes} label="Valor de inventario" value={valorInventario.value} />
        <KpiCard icon={ArrowDownCircle} label="Por cobrar" value={porCobrar.value} />
        <KpiCard icon={ArrowUpCircle} label="Por pagar" />
        <KpiCard icon={Receipt} label="Ticket promedio" value={ticket.value} />
        <KpiCard icon={AlertTriangle} label="Bajo stock / agotados" value={bajoStock.value} />
      </div>

      {/* Escritorio: gráficos */}
      <div className="hidden gap-4 lg:grid lg:grid-cols-3">
        <div className="lg:col-span-2"><ChartCard title="Ventas de la semana" icon={BarChart3} empty emptyHint="Aún no hay ventas registradas." /></div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="mb-3 text-sm font-bold text-[var(--text)]">Estado del inventario</p>
          {invBreakdown.inStock + invBreakdown.low + invBreakdown.out === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--text-soft)]">Aún no hay productos en inventario.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              <li className="flex items-center justify-between"><span className="text-[var(--text)]">En stock</span><span className="font-semibold text-[#0f766e] dark:text-[#6ee7b7]">{invBreakdown.inStock}</span></li>
              <li className="flex items-center justify-between"><span className="text-[var(--text)]">Bajo</span><span className="font-semibold text-[#b45309] dark:text-[#fbbf24]">{invBreakdown.low}</span></li>
              <li className="flex items-center justify-between"><span className="text-[var(--text)]">Agotado</span><span className="font-semibold text-[#dc2626]">{invBreakdown.out}</span></li>
            </ul>
          )}
        </div>
      </div>

      {/* Escritorio: Clientes por tipo + Productos por categoría */}
      <div className="hidden gap-4 lg:grid lg:grid-cols-2">
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
      </div>

      <AttentionList items={[]} />
    </div>
  );
}
