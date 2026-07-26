import { formatMoney } from "@/lib/format";
import { QuoteStatusBadge } from "./quote-status-badge";

type Item = { id: string; description: string; quantity: number; unit_price: number; discount_pct: number; tax_rate: number };
type Quote = {
  number: number | null; status: string; currency: string; notes: string | null; valid_until: string | null;
  clients?: { name: string } | null; branches?: { name: string } | null;
  items: Item[]; computed: { subtotal: number; discountTotal: number; taxTotal: number; total: number; lines: { neto: number }[] };
};

export function QuoteDocument({ quote }: { quote: Quote }) {
  const c = quote.currency;
  const overdue = !!quote.valid_until && quote.valid_until < new Date().toISOString().slice(0, 10) && ["sent", "accepted"].includes(quote.status);
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-lg font-extrabold text-[var(--text)]">{quote.number != null ? `Presupuesto #${quote.number}` : "BORRADOR"}</p>
            <p className="text-sm text-[var(--text-soft)]">{quote.clients?.name ?? "Consumidor final"} · {quote.branches?.name ?? "—"}</p>
          </div>
          <div className="flex items-center gap-2">
            {overdue && <span className="rounded-full bg-[#dc2626]/10 px-2 py-0.5 text-xs font-medium text-[#dc2626]">Vencido</span>}
            <QuoteStatusBadge status={quote.status} />
          </div>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--text-soft)]">
              <th className="py-1 font-medium">Descripción</th><th className="font-medium">Cant.</th>
              <th className="font-medium">Precio</th><th className="font-medium">Desc%</th><th className="font-medium">IVA%</th>
              <th className="text-right font-medium">Neto</th>
            </tr>
          </thead>
          <tbody>
            {quote.items.map((it, i) => (
              <tr key={it.id} className="border-b border-[var(--border)]">
                <td className="py-1.5 text-[var(--text)]">{it.description}</td>
                <td className="text-[var(--text-soft)]">{Number(it.quantity)}</td>
                <td className="text-[var(--text-soft)]">{formatMoney(Number(it.unit_price), c)}</td>
                <td className="text-[var(--text-soft)]">{Number(it.discount_pct)}%</td>
                <td className="text-[var(--text-soft)]">{Number(it.tax_rate)}%</td>
                <td className="text-right text-[var(--text)]">{formatMoney(quote.computed.lines[i]?.neto ?? 0, c)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-3 ml-auto max-w-xs space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-[var(--text-soft)]">Subtotal</span><span className="text-[var(--text)]">{formatMoney(quote.computed.subtotal, c)}</span></div>
          <div className="flex justify-between"><span className="text-[var(--text-soft)]">Descuentos</span><span className="text-[var(--text)]">{formatMoney(quote.computed.discountTotal, c)}</span></div>
          <div className="flex justify-between"><span className="text-[var(--text-soft)]">Impuesto</span><span className="text-[var(--text)]">{formatMoney(quote.computed.taxTotal, c)}</span></div>
          <div className="flex justify-between border-t border-[var(--border)] pt-1 text-base font-bold text-[var(--text)]"><span>Total</span><span>{formatMoney(quote.computed.total, c)}</span></div>
        </div>
      </div>
      {quote.valid_until && <p className="text-sm text-[var(--text-soft)]">Válido hasta: {new Date(quote.valid_until).toLocaleDateString("es-VE")}</p>}
      {quote.notes && <p className="text-sm text-[var(--text-soft)]">Notas: {quote.notes}</p>}
    </div>
  );
}
