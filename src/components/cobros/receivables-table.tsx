import Link from "next/link";
import type { ReceivableClientRow } from "@/lib/cobros/queries";
import type { SortDir } from "@/lib/sorting";
import { formatMoney, formatDateOnly } from "@/lib/format";
import { DataTable, type Column } from "@/components/ui/data-table";
import { DANGER_TEXT } from "@/lib/ui-tokens";

function columns(currency: string): Column<ReceivableClientRow>[] {
  return [
    {
      key: "name", label: "Cliente", width: "40%", sortable: true, natural: "asc",
      cell: (r) => r.clientId
        ? <Link href={`/finanzas/cuentas-por-cobrar/${r.clientId}`} className="font-medium text-[var(--text)] transition-colors hover:text-[#0e7490] dark:hover:text-[#5eead4]">{r.name}</Link>
        : <span className="text-[var(--text-soft)]">{r.name}</span>,
    },
    { key: "totalDue", label: "Total adeudado", width: "20%", align: "right", sortable: true, natural: "desc", cell: (r) => <span className="text-[var(--text)]">{formatMoney(r.totalDue, currency)}</span> },
    { key: "overdue", label: "Vencido", width: "20%", align: "right", sortable: true, natural: "desc", cell: (r) => <span className={r.overdueAmount > 0 ? DANGER_TEXT : "text-[var(--text-soft)]"}>{r.overdueAmount > 0 ? formatMoney(r.overdueAmount, currency) : "—"}</span> },
    { key: "oldestDue", label: "Vto. más antiguo", width: "20%", sortable: true, natural: "asc", cell: (r) => <span className="text-[var(--text-soft)]">{formatDateOnly(r.oldestDueDate)}</span> },
  ];
}

export const RECEIVABLE_COL_WIDTHS = ["40%", "20%", "20%", "20%"];

export function ReceivablesTable({ rows, currency, sort }: {
  rows: ReceivableClientRow[]; currency: string; sort: { key: string; dir: SortDir };
}) {
  return <DataTable rows={rows} columns={columns(currency)} rowKey={(r) => r.clientId ?? "none"} sort={sort} caption="Deuda por cliente" />;
}
