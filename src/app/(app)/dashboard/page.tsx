import { createClient } from "@/lib/supabase/server";
import { DollarSign, TrendingUp, Users, Boxes, ArrowDownCircle, ArrowUpCircle, Receipt, AlertTriangle, BarChart3, PieChart } from "lucide-react";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { ChartCard } from "@/components/dashboard/chart-card";
import { AttentionList } from "@/components/dashboard/attention-list";
import { PeriodSelector } from "@/components/dashboard/period-selector";

export default async function Dashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("full_name").eq("id", user.id).single()
    : { data: null };
  const firstName = ((profile?.full_name ?? "") as string).split(" ")[0] || "";

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
        <KpiCard icon={DollarSign} label="Ventas del mes" />
        <KpiCard icon={Users} label="Total de clientes" />
        <KpiCard icon={ArrowDownCircle} label="Por cobrar" />
        <KpiCard icon={AlertTriangle} label="Bajo stock" />
      </div>

      {/* Escritorio: 4 KPIs primarios + 4 secundarios */}
      <div className="hidden grid-cols-4 gap-3 lg:grid">
        <KpiCard icon={DollarSign} label="Ventas del mes" />
        <KpiCard icon={TrendingUp} label="Utilidad del mes" />
        <KpiCard icon={Users} label="Total de clientes" />
        <KpiCard icon={Boxes} label="Valor de inventario" />
        <KpiCard icon={ArrowDownCircle} label="Por cobrar" />
        <KpiCard icon={ArrowUpCircle} label="Por pagar" />
        <KpiCard icon={Receipt} label="Ticket promedio" />
        <KpiCard icon={AlertTriangle} label="Bajo stock / agotados" />
      </div>

      {/* Escritorio: gráficos */}
      <div className="hidden gap-4 lg:grid lg:grid-cols-3">
        <div className="lg:col-span-2"><ChartCard title="Ventas de la semana" icon={BarChart3} empty emptyHint="Aún no hay ventas registradas." /></div>
        <ChartCard title="Estado del inventario" icon={PieChart} empty emptyHint="Aún no hay productos en inventario." />
      </div>

      <AttentionList items={[]} />
    </div>
  );
}
