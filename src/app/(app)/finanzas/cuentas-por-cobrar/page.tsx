import { redirect } from "next/navigation";
import { CircleCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { listReceivablesByClient } from "@/lib/cobros/queries";
import { canRegisterPayment } from "@/lib/cobros/permissions";
import { formatMoney } from "@/lib/format";
import { getTenantSettings } from "@/lib/tenant";
import { todayISO } from "@/lib/tz";
import { ReceivablesToolbar } from "@/components/cobros/receivables-toolbar";
import { ReceivablesTable } from "@/components/cobros/receivables-table";
import { ReceivableRowCard } from "@/components/cobros/receivable-row-card";
import { EmptyState } from "@/components/shared/empty-state";
import { ModuleHeader } from "@/components/shared/module-header";
import { ModuleGuide } from "@/components/shared/module-guide";
import { GUIDES } from "@/lib/guides";
import type { Role } from "@/lib/auth/roles";
import { DANGER_TEXT } from "@/lib/ui-tokens";

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
  const { currency, timezone: tz } = await getTenantSettings(sb);
  const rows = await listReceivablesByClient(sb, { search: sp.q ?? "", filter, today: todayISO(tz) });
  const totalDue = rows.reduce((s, r) => s + r.totalDue, 0);
  const overdue = rows.reduce((s, r) => s + r.overdueAmount, 0);

  return (
    <div className="space-y-4 p-6">
      <ModuleHeader module="cuentas_por_cobrar" actions={
        <div className="text-sm text-[var(--text-soft)]">
          Total: <span className="font-semibold text-[var(--text)]">{formatMoney(totalDue, currency)}</span>
          {overdue > 0 && <> · Vencido: <span className={`font-semibold ${DANGER_TEXT}`}>{formatMoney(overdue, currency)}</span></>}
        </div>} />

      <ReceivablesToolbar />

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
          <EmptyState icon={CircleCheck} tone="ok" title="Nadie te debe"
            hint="Las ventas a crédito con saldo aparecen aquí."
            secondary={<ModuleGuide guide={GUIDES.cuentas_por_cobrar} />} />
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
