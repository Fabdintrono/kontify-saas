import { formatMoney, formatDateOnly } from "@/lib/format";
import { QuoteStatusBadge } from "./quote-status-badge";
import { DocumentLines } from "@/components/shared/document-lines";
import { StatusBadge } from "@/components/ui/status-badge";

type Item = { id: string; description: string; quantity: number; unit_price: number; discount_pct: number; tax_rate: number };
type Quote = {
  number: number | null; status: string; currency: string; notes: string | null; valid_until: string | null;
  clients?: { name: string } | null; branches?: { name: string } | null;
  items: Item[]; computed: { subtotal: number; discountTotal: number; taxTotal: number; total: number; lines: { neto: number }[] };
};

export function QuoteDocument({ quote, today }: { quote: Quote; today: string }) {
  const c = quote.currency;
  const overdue = !!quote.valid_until && quote.valid_until < today && ["sent", "accepted"].includes(quote.status);
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-lg font-extrabold text-[var(--text)]">{quote.number != null ? `Presupuesto #${quote.number}` : "BORRADOR"}</p>
            <p className="text-sm text-[var(--text-soft)]">{quote.clients?.name ?? "Consumidor final"} · {quote.branches?.name ?? "—"}</p>
          </div>
          <div className="flex items-center gap-2">
            {overdue && <StatusBadge tone="danger" icon="alert" label="Vencido" />}
            <QuoteStatusBadge status={quote.status} />
          </div>
        </div>
        <DocumentLines items={quote.items} netos={quote.computed.lines.map((l) => l.neto)} currency={c} />
        <div className="mt-3 ml-auto max-w-xs space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-[var(--text-soft)]">Subtotal</span><span className="text-[var(--text)]">{formatMoney(quote.computed.subtotal, c)}</span></div>
          <div className="flex justify-between"><span className="text-[var(--text-soft)]">Descuentos</span><span className="text-[var(--text)]">{formatMoney(quote.computed.discountTotal, c)}</span></div>
          <div className="flex justify-between"><span className="text-[var(--text-soft)]">Impuesto</span><span className="text-[var(--text)]">{formatMoney(quote.computed.taxTotal, c)}</span></div>
          <div className="flex justify-between border-t border-[var(--border)] pt-1 text-base font-bold text-[var(--text)]"><span>Total</span><span>{formatMoney(quote.computed.total, c)}</span></div>
        </div>
      </div>
      {quote.valid_until && <p className="text-sm text-[var(--text-soft)]">Válido hasta: {formatDateOnly(quote.valid_until)}</p>}
      {quote.notes && <p className="text-sm text-[var(--text-soft)]">Notas: {quote.notes}</p>}
    </div>
  );
}
