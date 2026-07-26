import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTenantCurrency } from "@/lib/productos/queries";
import { salesReport } from "@/lib/reportes/queries";
import { monthRange } from "@/lib/reportes/ranges";
import { canAccess, type Role } from "@/lib/auth/roles";
import { formatMoney } from "@/lib/format";
import { PeriodSelector } from "@/components/reportes/period-selector";
import { BarChart } from "@/components/reportes/bar-chart";

export default async function ReporteVentasPage({ searchParams }: {
  searchParams: Promise<{ from?: string; to?: string; branch?: string }>;
}) {
  const sp = await searchParams;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  const { data: mem } = await sb.from("memberships").select("role").eq("user_id", user!.id).single();
  const role = (mem?.role ?? "vendedor") as Role;
  if (!canAccess(role, "reportes")) redirect("/dashboard");

  const def = monthRange(new Date());
  const from = sp.from || def.from;
  const to = sp.to || def.to;
  const isBackOffice = ["owner", "admin", "administrativo"].includes(role);

  const [report, currency, { data: branches }] = await Promise.all([
    salesReport(sb, { from, to, branchId: sp.branch || null }),
    getTenantCurrency(sb),
    sb.from("branches").select("id, name").order("is_main", { ascending: false }),
  ]);
  const s = report.summary;
  const dayBars = report.byDay.map((d) => ({ label: new Date(`${d.date}T00:00:00`).toLocaleDateString("es-VE", { day: "2-digit", month: "2-digit" }), value: d.revenue }));

  const card = "rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4";
  return (
    <div className="space-y-4 p-6">
      <h1 className="text-xl font-extrabold tracking-[-0.4px] text-[var(--text)]">Reporte de ventas</h1>
      <PeriodSelector branches={(branches ?? []) as any} showBranch={isBackOffice} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Ventas" value={String(s.count)} />
        <Kpi label="Ingresos" value={formatMoney(s.revenue, currency)} />
        <Kpi label="Utilidad" value={formatMoney(s.utility, currency)} sub={`${s.marginPct}% margen`} />
        <Kpi label="Ticket promedio" value={formatMoney(s.avgTicket, currency)} />
      </div>
      {s.costIncompleteCount > 0 && (
        <p className="text-xs text-[var(--text-soft)]">{s.costIncompleteCount} venta(s) sin costo registrado — la utilidad puede estar sobreestimada.</p>
      )}

      {s.count === 0 ? (
        <p className="text-sm text-[var(--text-soft)]">No hay ventas en el período seleccionado.</p>
      ) : (
        <>
          <div className={card}>
            <p className="mb-3 text-sm font-bold text-[var(--text)]">Ventas por día</p>
            <BarChart data={dayBars} currency={currency} />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className={card}>
              <p className="mb-3 text-sm font-bold text-[var(--text)]">Top productos</p>
              <SimpleTable rows={report.byProduct.slice(0, 10).map((p) => [p.name, String(p.qty), formatMoney(p.revenue, currency)])} head={["Producto", "Cant.", "Ingreso"]} />
            </div>
            <div className={card}>
              <p className="mb-3 text-sm font-bold text-[var(--text)]">Por vendedor</p>
              <SimpleTable rows={report.bySeller.map((v) => [v.name, String(v.count), formatMoney(v.revenue, currency), formatMoney(v.utility, currency)])} head={["Vendedor", "Ventas", "Ingreso", "Utilidad"]} />
            </div>
            <div className={card}>
              <p className="mb-3 text-sm font-bold text-[var(--text)]">Por cliente</p>
              <SimpleTable rows={report.byClient.slice(0, 10).map((c) => [c.name, String(c.count), formatMoney(c.revenue, currency)])} head={["Cliente", "Ventas", "Ingreso"]} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <p className="text-xs text-[var(--text-soft)]">{label}</p>
      <p className="mt-1 text-lg font-extrabold text-[var(--text)]">{value}</p>
      {sub && <p className="text-xs text-[var(--text-soft)]">{sub}</p>}
    </div>
  );
}

function SimpleTable({ head, rows }: { head: string[]; rows: string[][] }) {
  if (rows.length === 0) return <p className="text-sm text-[var(--text-soft)]">Sin datos.</p>;
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--text-soft)]">
          {head.map((h, i) => <th key={i} className={`py-1 font-medium ${i > 0 ? "text-right" : ""}`}>{h}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b border-[var(--border)]">
            {r.map((c, j) => <td key={j} className={`py-1.5 ${j > 0 ? "text-right text-[var(--text-soft)]" : "text-[var(--text)]"}`}>{c}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
