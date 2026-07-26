import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSale } from "@/lib/ventas/queries";
import { canVoidSale } from "@/lib/ventas/permissions";
import { getTenantCurrency } from "@/lib/productos/queries";
import { listPayments } from "@/lib/cobros/queries";
import { canRegisterPayment, canVoidPayment, canEditDueDate } from "@/lib/cobros/permissions";
import { deleteDraftAction, voidSaleAction } from "@/app/(app)/operaciones/facturacion/actions";
import { SaleDocument } from "@/components/ventas/sale-document";
import { PaymentsHistory } from "@/components/cobros/payments-history";
import { PaymentForm } from "@/components/cobros/payment-form";
import { DueDateField } from "@/components/cobros/due-date-field";
import type { Role } from "@/lib/auth/roles";

export default async function VentaDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createClient();
  const sale = await getSale(sb, id);
  if (!sale) notFound();
  const { data: { user } } = await sb.auth.getUser();
  const { data: mem } = await sb.from("memberships").select("role").eq("user_id", user!.id).single();
  const role = (mem?.role ?? "vendedor") as Role;

  const issued = sale.status === "issued";
  const balance = Number(sale.balance);
  const [payments, currency] = await Promise.all([
    issued ? listPayments(sb, id) : Promise.resolve([]),
    getTenantCurrency(sb),
  ]);
  const hasPayments = Number(sale.paid_amount) > 0;

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/operaciones/facturacion" className="text-sm text-[var(--text-soft)] hover:text-[#0e7490]">← Ventas</Link>
        <div className="flex items-center gap-2">
          {sale.status === "draft" && (
            <>
              <Link href={`/operaciones/facturacion/${sale.id}/editar`}
                className="flex items-center gap-1.5 rounded-[10px] border border-[var(--border)] px-3 py-2 text-sm text-[var(--text)]">
                <Pencil className="h-4 w-4" /> Editar
              </Link>
              <form action={deleteDraftAction}>
                <input type="hidden" name="id" value={sale.id} />
                <button className="rounded-[10px] border border-[var(--border)] px-3 py-2 text-sm text-[#dc2626]">Eliminar borrador</button>
              </form>
            </>
          )}
          {issued && canVoidSale(role) && !hasPayments && (
            <form action={voidSaleAction}>
              <input type="hidden" name="id" value={sale.id} />
              <input type="hidden" name="clientId" value={sale.client_id ?? ""} />
              <button className="rounded-[10px] border border-[var(--border)] px-3 py-2 text-sm text-[#dc2626]">Anular</button>
            </form>
          )}
        </div>
      </div>

      <SaleDocument sale={sale as any} />

      {issued && (
        <div className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-bold text-[var(--text)]">Cobros</p>
            <DueDateField saleId={sale.id} dueDate={sale.due_date ?? null} canEdit={canEditDueDate(role)} />
          </div>
          <PaymentsHistory payments={payments} saleId={sale.id} currency={currency} canVoid={canVoidPayment(role)} />
          {balance > 0 && canRegisterPayment(role) && (
            <PaymentForm saleId={sale.id} balance={balance} currency={currency} />
          )}
        </div>
      )}
    </div>
  );
}
