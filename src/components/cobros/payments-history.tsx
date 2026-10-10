import { formatMoney, formatDateOnly } from "@/lib/format";
import { voidPaymentAction } from "@/app/(app)/finanzas/cuentas-por-cobrar/actions";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { flashFor } from "@/lib/flash";

type Payment = { id: string; amount: number; method: string | null; reference: string | null; paidAt: string; voided: boolean };

export function PaymentsHistory({ payments, saleId, currency, canVoid }: {
  payments: Payment[]; saleId: string; currency: string; canVoid: boolean;
}) {
  if (payments.length === 0) return <p className="text-sm text-[var(--text-soft)]">Sin cobros registrados.</p>;
  return (
    <ul className="divide-y divide-[var(--border)]">
      {payments.map((p) => (
        <li key={p.id} className={`flex items-center justify-between py-2 text-sm ${p.voided ? "opacity-50 line-through" : ""}`}>
          <span className="text-[var(--text)]">
            {formatMoney(p.amount, currency)}
            <span className="ml-2 text-xs text-[var(--text-soft)]">
              {formatDateOnly(p.paidAt)}{p.method ? ` · ${p.method}` : ""}{p.reference ? ` · ${p.reference}` : ""}
            </span>
          </span>
          {canVoid && !p.voided && (
            <ConfirmDialog action={voidPaymentAction} payload={{ id: p.id, saleId }}
              title={`¿Anular el abono de ${formatMoney(p.amount, currency)}?`}
              description="El saldo de la venta vuelve a subir. No se puede deshacer."
              confirmLabel="Anular abono" successToast={flashFor("abono-anulado")}
              triggerClassName="text-xs font-medium text-[var(--text-soft)] hover:text-[#dc2626]">
              Anular
            </ConfirmDialog>
          )}
        </li>
      ))}
    </ul>
  );
}
