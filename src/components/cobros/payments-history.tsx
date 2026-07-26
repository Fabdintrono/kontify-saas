import { formatMoney } from "@/lib/format";
import { voidPaymentAction } from "@/app/(app)/finanzas/cuentas-por-cobrar/actions";

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
              {new Date(p.paidAt).toLocaleDateString("es-VE")}{p.method ? ` · ${p.method}` : ""}{p.reference ? ` · ${p.reference}` : ""}
            </span>
          </span>
          {canVoid && !p.voided && (
            <form action={voidPaymentAction}>
              <input type="hidden" name="id" value={p.id} />
              <input type="hidden" name="saleId" value={saleId} />
              <button className="text-xs text-[var(--text-soft)] hover:text-[#dc2626]">Anular</button>
            </form>
          )}
        </li>
      ))}
    </ul>
  );
}
