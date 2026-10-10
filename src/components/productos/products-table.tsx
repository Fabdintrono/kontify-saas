import Link from "next/link";
import type { ProductListRow } from "@/lib/productos/queries";
import type { SortDir } from "@/lib/sorting";
import { formatMoney } from "@/lib/format";
import { DataTable, type Column } from "@/components/ui/data-table";
import { CategoryBadge } from "./category-badge";

function columns(currency: string): Column<ProductListRow>[] {
  return [
    {
      key: "name", label: "Nombre", width: "34%", sortable: true, natural: "asc",
      cell: (r) => (
        <>
          <Link href={`/operaciones/productos/${r.id}`} className="font-medium text-[var(--text)] transition-colors hover:text-[#0e7490] dark:hover:text-[#5eead4]">{r.name}</Link>
          <span className="ml-2 text-xs text-[var(--text-soft)]">{r.kind === "service" ? "Servicio" : "Bien"}</span>
        </>
      ),
    },
    { key: "sku", label: "SKU", width: "16%", sortable: true, natural: "asc", cell: (r) => <span className="text-[var(--text-soft)]">{r.sku || "—"}</span> },
    { key: "category", label: "Categoría", width: "20%", sortable: true, natural: "asc", cell: (r) => <CategoryBadge name={r.categoryName} /> },
    { key: "price", label: "Precio", width: "16%", align: "right", sortable: true, natural: "desc", cell: (r) => <span className="text-[var(--text)]">{formatMoney(r.price, currency)}</span> },
    {
      key: "status", label: "Estado", width: "14%", sortable: true, natural: "desc",
      cell: (r) => r.active
        ? <span className="text-xs font-medium text-[#0f766e] dark:text-[#6ee7b7]">Activo</span>
        : <span className="text-xs font-medium text-[var(--text-soft)]">Archivado</span>,
    },
  ];
}

export const PRODUCT_COL_WIDTHS = ["34%", "16%", "20%", "16%", "14%"];

export function ProductsTable({ rows, currency, sort }: {
  rows: ProductListRow[]; currency: string; sort: { key: string; dir: SortDir };
}) {
  return <DataTable rows={rows} columns={columns(currency)} rowKey={(r) => r.id} sort={sort} caption="Productos" />;
}
