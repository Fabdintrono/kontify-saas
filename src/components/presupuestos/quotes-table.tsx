import Link from "next/link";
import type { QuoteListRow } from "@/lib/presupuestos/queries";
import { formatMoney, formatDate, formatDateOnly } from "@/lib/format";
import { QuoteStatusBadge } from "./quote-status-badge";

function isOverdue(r: QuoteListRow, today: string): boolean {
  return !!r.validUntil && r.validUntil < today && ["sent", "accepted"].includes(r.status);
}

export function QuotesTable({ rows, tz, today }: { rows: QuoteListRow[]; tz: string; today: string }) {
  return (
    <table className="hidden w-full text-sm lg:table">
      <thead>
        <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--text-soft)]">
          <th className="py-2 font-medium">Nº</th><th className="font-medium">Fecha</th><th className="font-medium">Cliente</th>
          <th className="font-medium">Total</th><th className="font-medium">Vigencia</th><th className="font-medium">Estado</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className="border-b border-[var(--border)] hover:bg-[var(--bg)]">
            <td className="py-2.5">
              <Link href={`/operaciones/presupuestos/${r.id}`} className="font-medium text-[var(--text)] hover:text-[#0e7490]">
                {r.number != null ? `#${r.number}` : "—"}
              </Link>
            </td>
            <td className="text-[var(--text-soft)]">{formatDate(r.createdAt, tz)}</td>
            <td className="text-[var(--text)]">{r.clientName ?? "Consumidor final"}</td>
            <td className="text-[var(--text)]">{formatMoney(r.total, r.currency)}</td>
            <td className={isOverdue(r, today) ? "text-[#dc2626]" : "text-[var(--text-soft)]"}>
              {formatDateOnly(r.validUntil)}{isOverdue(r, today) ? " · vencido" : ""}
            </td>
            <td><QuoteStatusBadge status={r.status} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
