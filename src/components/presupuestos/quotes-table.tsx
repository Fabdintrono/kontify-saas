import Link from "next/link";
import type { QuoteListRow } from "@/lib/presupuestos/queries";
import type { SortDir } from "@/lib/sorting";
import { formatMoney, formatDate, formatDateOnly } from "@/lib/format";
import { DataTable, type Column } from "@/components/ui/data-table";
import { QuoteStatusBadge } from "./quote-status-badge";
import { DANGER_TEXT } from "@/lib/ui-tokens";

function isOverdue(r: QuoteListRow, today: string): boolean {
  return !!r.validUntil && r.validUntil < today && ["sent", "accepted"].includes(r.status);
}

function columns(tz: string, today: string): Column<QuoteListRow>[] {
  return [
    {
      key: "number", label: "Nº", width: "8%", sortable: true, natural: "desc",
      cell: (r) => (
        <Link href={`/operaciones/presupuestos/${r.id}`} className="font-medium text-[var(--text)] transition-colors hover:text-[#0e7490] dark:hover:text-[#5eead4]">
          {r.number != null ? `#${r.number}` : "—"}
        </Link>
      ),
    },
    { key: "date", label: "Fecha", width: "14%", sortable: true, natural: "desc", cell: (r) => <span className="text-[var(--text-soft)]">{formatDate(r.createdAt, tz)}</span> },
    { key: "client", label: "Cliente", width: "32%", sortable: true, natural: "asc", cell: (r) => <span className="text-[var(--text)]">{r.clientName ?? "Consumidor final"}</span> },
    { key: "total", label: "Total", width: "16%", align: "right", sortable: true, natural: "desc", cell: (r) => <span className="text-[var(--text)]">{formatMoney(r.total, r.currency)}</span> },
    {
      key: "validUntil", label: "Vigencia", width: "16%", sortable: true, natural: "asc",
      cell: (r) => (
        <span className={isOverdue(r, today) ? DANGER_TEXT : "text-[var(--text-soft)]"}>
          {formatDateOnly(r.validUntil)}{isOverdue(r, today) ? " · vencido" : ""}
        </span>
      ),
    },
    // Sin orden: la etiqueta mezcla el estado guardado con el vencimiento, calculado después.
    { key: "status", label: "Estado", width: "14%", cell: (r) => <QuoteStatusBadge status={r.status} /> },
  ];
}

export const QUOTE_COL_WIDTHS = ["8%", "14%", "32%", "16%", "16%", "14%"];

export function QuotesTable({ rows, tz, today, sort }: {
  rows: QuoteListRow[]; tz: string; today: string; sort: { key: string; dir: SortDir };
}) {
  return <DataTable rows={rows} columns={columns(tz, today)} rowKey={(r) => r.id} sort={sort} caption="Presupuestos" />;
}
