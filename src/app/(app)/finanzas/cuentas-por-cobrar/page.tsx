import { redirect } from "next/navigation";
import { Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getTenantCurrency } from "@/lib/productos/queries";
import { listReceivablesByClient } from "@/lib/cobros/queries";
import { canRegisterPayment } from "@/lib/cobros/permissions";
import { formatMoney } from "@/lib/format";
import { ReceivablesToolbar } from "@/components/cobros/receivables-toolbar";
import { ReceivablesTable } from "@/components/cobros/receivables-table";
import { ReceivableRowCard } from "@/components/cobros/receivable-row-card";
import { EmptyState } from "@/components/shared/empty-state";
import type { Role } from "@/lib/auth/roles";

export default async function CuentasPorCobrarPage({ searchParams }: {
  searchParams: Promise<{ q?: string; filter?: string }>;
}) {
  const sp = await searchParams;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  const { data: mem } = await sb.from("memberships").select("role").eq("user_id", user!.id).single();
  const role = (mem?.role ?? "vendedor") as Role;
  if (!canRegisterPayment(role)) redirect("/dashboard");

  const filter = (sp.filter === "vencidos" ? "vencidos" : "todos") as "todos" | "vencidos";
  const [rows, currency] = await Promise.all([
    listReceivablesByClient(sb, { search: sp.q ?? "", filter }),
    getTenantCurrency(sb),
  ]);
  const totalDue = rows.reduce((s, r) => s + r.totalDue, 0);
  const overdue = rows.reduce((s, r) => s + r.overdueAmount, 0);

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-extrabold tracking-[-0.4px] text-[var(--text)]">Cuentas por cobrar</h1>
        <div className="text-sm text-[var(--text-soft)]">
          Total: <span className="font-semibold text-[var(--text)]">{formatMoney(totalDue, currency)}</span>
          {overdue > 0 && <> · Vencido: <span className="font-semibold text-[#dc2626]">{formatMoney(overdue, currency)}</span></>}
        </div>
      </div>

      <ReceivablesToolbar />

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
          <EmptyState icon={Wallet} title="Sin saldos pendientes" hint="Las ventas a crédito con saldo aparecen aquí." />
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-2 lg:p-4">
          <ReceivablesTable rows={rows} currency={currency} />
          <div className="space-y-2 lg:hidden">{rows.map((r) => <ReceivableRowCard key={r.clientId ?? "none"} r={r} currency={currency} />)}</div>
        </div>
      )}
    </div>
  );
}
