import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSale } from "@/lib/ventas/queries";
import { canVoidSale } from "@/lib/ventas/permissions";
import { getTenantSettings } from "@/lib/tenant";
import { todayISO } from "@/lib/tz";
import { listPayments } from "@/lib/cobros/queries";
import { canRegisterPayment, canVoidPayment, canEditDueDate } from "@/lib/cobros/permissions";
import { paymentStatusOf } from "@/lib/cobros/status";
import { deleteDraftAction, voidSaleAction } from "@/app/(app)/operaciones/facturacion/actions";
import { SaleDocument } from "@/components/ventas/sale-document";
import { PaymentsHistory } from "@/components/cobros/payments-history";
import { PaymentForm } from "@/components/cobros/payment-form";
import { DueDateField } from "@/components/cobros/due-date-field";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { buttonCls } from "@/components/ui/button";
import { flashFor } from "@/lib/flash";
import type { Role } from "@/lib/auth/roles";
import { Page } from "@/components/shared/page";

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
  const [payments, settings] = await Promise.all([
    issued ? listPayments(sb, id) : Promise.resolve([]),
    getTenantSettings(sb),
  ]);
  const { currency, timezone: tz } = settings;
  const today = todayISO(tz);
  const hasPayments = Number(sale.paid_amount) > 0;
  const paymentStatus = paymentStatusOf(
    { status: sale.status, total: Number(sale.total), paidAmount: Number(sale.paid_amount), dueDate: sale.due_date ?? null },
    today,
  );

  const dangerBtn = buttonCls("danger");

  return (
    <Page>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/operaciones/facturacion" className="text-sm text-[var(--text-soft)] hover:text-[#0e7490]">← Ventas</Link>
        <div className="flex items-center gap-2">
          {sale.status === "draft" && (
            <>
              <Link href={`/operaciones/facturacion/${sale.id}/editar`} className={buttonCls("secondary")}>
                <Pencil className="h-4 w-4" aria-hidden="true" /> Editar
              </Link>
              <ConfirmDialog action={deleteDraftAction} payload={{ id: sale.id }}
                title="¿Eliminar este borrador?" description="Se borra la venta en preparación. No afecta stock ni numeración."
                confirmLabel="Eliminar borrador" triggerClassName={dangerBtn}>
                Eliminar borrador
              </ConfirmDialog>
            </>
          )}
          {issued && canVoidSale(role) && !hasPayments && (
            <ConfirmDialog action={voidSaleAction} payload={{ id: sale.id, clientId: sale.client_id ?? "" }}
              title={`¿Anular la venta #${sale.number}?`} description="El stock vuelve al inventario y la venta queda anulada. No se puede deshacer."
              confirmLabel="Anular venta" successToast={flashFor("venta-anulada", sale.number)} triggerClassName={dangerBtn}>
              Anular
            </ConfirmDialog>
          )}
        </div>
      </div>

      <SaleDocument sale={sale as any} paymentStatus={paymentStatus} />

      {issued && (
        <div className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-bold text-[var(--text)]">Cobros</p>
            {balance > 0 && <DueDateField saleId={sale.id} dueDate={sale.due_date ?? null} canEdit={canEditDueDate(role)} />}
          </div>
          <PaymentsHistory payments={payments} saleId={sale.id} currency={currency} canVoid={canVoidPayment(role)} />
          {balance > 0 && canRegisterPayment(role) && (
            <PaymentForm saleId={sale.id} balance={balance} currency={currency} today={today} />
          )}
        </div>
      )}
    </Page>
  );
}
