import Link from "next/link";
import type { SaleListRow } from "@/lib/ventas/queries";
import type { SortDir } from "@/lib/sorting";
import { formatMoney, formatDate } from "@/lib/format";
import { DataTable, type Column } from "@/components/ui/data-table";
import { SaleStatusBadge } from "./status-badge";
import { DANGER_TEXT_STRONG } from "@/lib/ui-tokens";

function columns(tz: string): Column<SaleListRow>[] {
  return [
    {
      key: "number", label: "Nº", width: "8%", sortable: true, natural: "desc",
      cell: (r) => (
        <Link href={`/operaciones/facturacion/${r.id}`} className="font-medium text-[var(--text)] transition-colors hover:text-[#0e7490] dark:hover:text-[#5eead4]">
          {r.number != null ? `#${r.number}` : "—"}
        </Link>
      ),
    },
    { key: "date", label: "Fecha", width: "14%", sortable: true, natural: "desc", cell: (r) => <span className="text-[var(--text-soft)]">{formatDate(r.issuedAt ?? r.createdAt, tz)}</span> },
    { key: "client", label: "Cliente", width: "32%", sortable: true, natural: "asc", cell: (r) => <span className="text-[var(--text)]">{r.clientName ?? "Consumidor final"}</span> },
    { key: "total", label: "Total", width: "16%", align: "right", sortable: true, natural: "desc", cell: (r) => <span className="text-[var(--text)]">{formatMoney(r.total, r.currency)}</span> },
    {
      key: "balance", label: "Saldo", width: "16%", align: "right", sortable: true, natural: "desc",
      cell: (r) => (
        <span className={r.paymentStatus === "vencida" ? DANGER_TEXT_STRONG : "text-[var(--text-soft)]"}>
          {r.status === "issued" && r.paymentStatus !== "pagada" ? formatMoney(r.balance, r.currency) : "—"}
        </span>
      ),
    },
    // Sin orden: el estado de pago se calcula después de la consulta, ordenar por él mentiría.
    { key: "status", label: "Estado", width: "14%", cell: (r) => <SaleStatusBadge status={r.status} paymentStatus={r.paymentStatus} /> },
  ];
}

export const SALE_COL_WIDTHS = ["8%", "14%", "32%", "16%", "16%", "14%"];

export function SalesTable({ rows, tz, sort }: { rows: SaleListRow[]; tz: string; sort: { key: string; dir: SortDir } }) {
  return <DataTable rows={rows} columns={columns(tz)} rowKey={(r) => r.id} sort={sort} caption="Ventas" />;
}
