import Link from "next/link";
import type { QuoteListRow } from "@/lib/presupuestos/queries";
import { formatMoney } from "@/lib/format";
import { QuoteStatusBadge } from "./quote-status-badge";

export function QuoteRowCard({ r }: { r: QuoteListRow }) {
  return (
    <Link href={`/operaciones/presupuestos/${r.id}`}
      className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 lg:hidden">
      <div className="min-w-0">
        <p className="truncate font-medium text-[var(--text)]">
          {r.number != null ? `#${r.number}` : "Borrador"} · {r.clientName ?? "Consumidor final"}
        </p>
        <p className="truncate text-xs text-[var(--text-soft)]">{formatMoney(r.total, r.currency)}</p>
      </div>
      <QuoteStatusBadge status={r.status} />
    </Link>
  );
}
