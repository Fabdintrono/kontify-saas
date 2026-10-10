import { formatMoney, formatDateOnly } from "@/lib/format";
import { round2 } from "@/lib/ventas/totals";
import type { PaymentStatus } from "@/lib/cobros/status";
import { SaleStatusBadge } from "./status-badge";

type Item = { id: string; description: string; quantity: number; unit_price: number; discount_pct: number; tax_rate: number };
type Sale = {
  number: number | null; status: string; currency: string; notes: string | null;
  payment_method: string | null; total: number; paid_amount: number; due_date?: string | null;
  clients?: { name: string } | null; branches?: { name: string } | null;
  items: Item[]; computed: { subtotal: number; discountTotal: number; taxTotal: number; total: number; lines: { neto: number }[] };
};

export function SaleDocument({ sale, paymentStatus }: { sale: Sale; paymentStatus?: PaymentStatus | null }) {
  const c = sale.currency;
  const paid = Number(sale.paid_amount), total = Number(sale.total);
  const balance = round2(total - paid);
  // La frase se arma con los datos, no con el estado: una vencida parcial dice lo pagado y lo que falta.
  const payParts = [
    paymentStatus === "pagada" && sale.payment_method ? sale.payment_method : null,
    paid > 0 && balance > 0 ? `pagado ${formatMoney(paid, c)} de ${formatMoney(total, c)}` : null,
    balance > 0 ? `saldo ${formatMoney(balance, c)}` : null,
    sale.due_date
      ? `${paymentStatus === "vencida" ? "venció el" : paymentStatus === "pagada" ? "vencía el" : "vence el"} ${formatDateOnly(sale.due_date)}`
      : null,
  ].filter(Boolean);
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-lg font-extrabold text-[var(--text)]">{sale.number != null ? `Venta #${sale.number}` : "BORRADOR"}</p>
            <p className="text-sm text-[var(--text-soft)]">{sale.clients?.name ?? "Consumidor final"} · {sale.branches?.name ?? "—"}</p>
          </div>
          <SaleStatusBadge status={sale.status} paymentStatus={paymentStatus} />
        </div>
        <table className="hidden w-full text-sm lg:table">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--text-soft)]">
              <th className="py-1 font-medium">Descripción</th><th className="font-medium">Cant.</th>
              <th className="font-medium">Precio</th><th className="font-medium">Desc%</th><th className="font-medium">IVA%</th>
              <th className="text-right font-medium">Neto</th>
            </tr>
          </thead>
          <tbody>
            {sale.items.map((it, i) => (
              <tr key={it.id} className="border-b border-[var(--border)]">
                <td className="py-1.5 text-[var(--text)]">{it.description}</td>
                <td className="text-[var(--text-soft)]">{Number(it.quantity)}</td>
                <td className="text-[var(--text-soft)]">{formatMoney(Number(it.unit_price), c)}</td>
                <td className="text-[var(--text-soft)]">{Number(it.discount_pct)}%</td>
                <td className="text-[var(--text-soft)]">{Number(it.tax_rate)}%</td>
                <td className="text-right text-[var(--text)]">{formatMoney(sale.computed.lines[i]?.neto ?? 0, c)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <ul data-lineas-movil className="space-y-2 lg:hidden">
          {sale.items.map((it, i) => (
            <li key={it.id} className="rounded-xl border border-[var(--border)] p-3">
              <p className="font-medium text-[var(--text)]">{it.description}</p>
              <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs text-[var(--text-soft)]">
                <div className="flex justify-between"><dt>Cant.</dt><dd className="text-[var(--text)]">{Number(it.quantity)}</dd></div>
                <div className="flex justify-between"><dt>Precio</dt><dd className="text-[var(--text)]">{formatMoney(Number(it.unit_price), c)}</dd></div>
                <div className="flex justify-between"><dt>Desc.</dt><dd className="text-[var(--text)]">{Number(it.discount_pct)}%</dd></div>
                <div className="flex justify-between"><dt>IVA</dt><dd className="text-[var(--text)]">{Number(it.tax_rate)}%</dd></div>
              </dl>
              <p className="mt-1 text-right text-sm font-semibold text-[var(--text)]">{formatMoney(sale.computed.lines[i]?.neto ?? 0, c)}</p>
            </li>
          ))}
        </ul>
        <div className="mt-3 ml-auto max-w-xs space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-[var(--text-soft)]">Subtotal</span><span className="text-[var(--text)]">{formatMoney(sale.computed.subtotal, c)}</span></div>
          <div className="flex justify-between"><span className="text-[var(--text-soft)]">Descuentos</span><span className="text-[var(--text)]">{formatMoney(sale.computed.discountTotal, c)}</span></div>
          <div className="flex justify-between"><span className="text-[var(--text-soft)]">Impuesto</span><span className="text-[var(--text)]">{formatMoney(sale.computed.taxTotal, c)}</span></div>
          <div className="flex justify-between border-t border-[var(--border)] pt-1 text-base font-bold text-[var(--text)]"><span>Total</span><span>{formatMoney(sale.computed.total, c)}</span></div>
        </div>
      </div>

      {sale.status === "issued" && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[var(--text-soft)]">Pago</span>
            <span className="flex flex-wrap items-center justify-end gap-2 font-medium text-[var(--text)]">
              <SaleStatusBadge status="issued" paymentStatus={paymentStatus ?? null} />
              {payParts.length ? <span>· {payParts.join(" · ")}</span> : null}
            </span>
          </div>
        </div>
      )}
      {sale.notes && <p className="text-sm text-[var(--text-soft)]">Notas: {sale.notes}</p>}
    </div>
  );
}
