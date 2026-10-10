import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getClientReceivable } from "@/lib/cobros/queries";
import { canRegisterPayment } from "@/lib/cobros/permissions";
import { formatMoney, formatDateOnly } from "@/lib/format";
import { getTenantSettings } from "@/lib/tenant";
import { todayISO } from "@/lib/tz";
import { PaymentForm } from "@/components/cobros/payment-form";
import type { Role } from "@/lib/auth/roles";

export default async function EstadoDeCuentaPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  const { data: mem } = await sb.from("memberships").select("role").eq("user_id", user!.id).single();
  const role = (mem?.role ?? "vendedor") as Role;
  if (!canRegisterPayment(role)) redirect("/dashboard");

  const { currency, timezone: tz } = await getTenantSettings(sb);
  const today = todayISO(tz);
  const data = await getClientReceivable(sb, { clientId, today });

  return (
    <div className="space-y-4 p-6">
      <Link href="/finanzas/cuentas-por-cobrar" className="text-sm text-[var(--text-soft)] hover:text-[#0e7490]">← Cuentas por cobrar</Link>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-extrabold tracking-[-0.4px] text-[var(--text)]">{data.clientName ?? "Cliente"}</h1>
        <div className="text-sm text-[var(--text-soft)]">
          Adeudado: <span className="font-semibold text-[var(--text)]">{formatMoney(data.totalDue, currency)}</span>
          {data.overdueAmount > 0 && <> · Vencido: <span className="font-semibold text-[#dc2626]">{formatMoney(data.overdueAmount, currency)}</span></>}
        </div>
      </div>

      {data.rows.length === 0 ? (
        <p className="text-sm text-[var(--text-soft)]">Sin saldos pendientes.</p>
      ) : (
        <div className="space-y-3">
          {data.rows.map((s) => (
            <div key={s.saleId} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <Link href={`/operaciones/facturacion/${s.saleId}`} className="font-medium text-[var(--text)] hover:text-[#0e7490]">Venta #{s.number}</Link>
                  <p className="text-xs text-[var(--text-soft)]">
                    Total {formatMoney(s.total, currency)} · Pagado {formatMoney(s.paid, currency)}
                    {s.dueDate ? ` · Vence ${formatDateOnly(s.dueDate)}` : ""}
                    {s.overdue ? " · VENCIDA" : ""}
                  </p>
                </div>
                <span className={`text-sm font-semibold ${s.overdue ? "text-[#dc2626]" : "text-[var(--text)]"}`}>Saldo {formatMoney(s.balance, currency)}</span>
              </div>
              <div className="mt-3"><PaymentForm saleId={s.saleId} balance={s.balance} currency={currency} today={today} /></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
