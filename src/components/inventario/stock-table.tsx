import Link from "next/link";
import type { StockRow } from "@/lib/inventario/queries";
import type { SortDir } from "@/lib/sorting";
import { DataTable, type Column } from "@/components/ui/data-table";
import { StockStatusBadge } from "./stock-status-badge";
import { DANGER_TEXT } from "@/lib/ui-tokens";

const COLUMNS: Column<StockRow>[] = [
  {
    key: "name", label: "Producto", width: "38%", sortable: true, natural: "asc",
    cell: (r) => (
      <Link href={`/operaciones/productos/${r.productId}`} className="font-medium text-[var(--text)] transition-colors hover:text-[#0e7490] dark:hover:text-[#5eead4]">{r.name}</Link>
    ),
  },
  { key: "sku", label: "SKU", width: "18%", sortable: true, natural: "asc", cell: (r) => <span className="text-[var(--text-soft)]">{r.sku || "—"}</span> },
  { key: "qty", label: "Existencia", width: "14%", align: "right", sortable: true, natural: "desc", cell: (r) => <span className={r.qty <= 0 ? DANGER_TEXT : "text-[var(--text)]"}>{r.qty}</span> },
  { key: "minStock", label: "Mínimo", width: "14%", align: "right", sortable: true, natural: "desc", cell: (r) => <span className="text-[var(--text-soft)]">{r.minStock}</span> },
  { key: "status", label: "Estado", width: "16%", sortable: true, natural: "asc", cell: (r) => <StockStatusBadge status={r.status} /> },
];

export const STOCK_COL_WIDTHS = COLUMNS.map((c) => c.width);

export function StockTable({ rows, sort }: { rows: StockRow[]; sort: { key: string; dir: SortDir } }) {
  return <DataTable rows={rows} columns={COLUMNS} rowKey={(r) => r.productId} sort={sort} caption="Existencias por producto" />;
}
