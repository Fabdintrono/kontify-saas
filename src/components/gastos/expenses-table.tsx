import Link from "next/link";
import { Repeat } from "lucide-react";
import type { ExpenseRow } from "@/lib/gastos/queries";
import type { SortDir } from "@/lib/sorting";
import { formatMoney, formatDateOnly } from "@/lib/format";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Tooltip } from "@/components/ui/tooltip";

function columns(currency: string, puedeEditar: boolean): Column<ExpenseRow>[] {
  return [
    { key: "date", label: "Fecha", width: "13%", sortable: true, natural: "desc", cell: (r) => <span className="text-[var(--text-soft)]">{formatDateOnly(r.spentOn)}</span> },
    {
      key: "description", label: "En qué se gastó", width: "37%", sortable: true, natural: "asc",
      cell: (r) => (
        <span className="flex min-w-0 items-center gap-2">
          {puedeEditar
            ? <Link href={`/finanzas/gastos/${r.id}/editar`} className="truncate font-medium text-[var(--text)] transition-colors hover:text-[#0e7490] dark:hover:text-[#5eead4]">{r.description}</Link>
            : <span className="truncate font-medium text-[var(--text)]">{r.description}</span>}
          {r.fromRecurring && (
            <Tooltip label="Viene de un gasto fijo">
              <span className="shrink-0 text-[var(--text-soft)]"><Repeat className="h-3.5 w-3.5" strokeWidth={2} aria-label="Viene de un gasto fijo" /></span>
            </Tooltip>
          )}
        </span>
      ),
    },
    { key: "category", label: "Categoría", width: "18%", sortable: true, natural: "asc", cell: (r) => <span className="text-[var(--text-soft)]">{r.categoryName ?? "Sin categoría"}</span> },
    { key: "supplier", label: "A quién", width: "18%", cell: (r) => <span className="text-[var(--text-soft)]">{r.supplier || "—"}</span> },
    { key: "amount", label: "Monto", width: "14%", align: "right", sortable: true, natural: "desc", cell: (r) => <span className="font-medium text-[var(--text)]">{formatMoney(r.amount, currency)}</span> },
  ];
}

export const EXPENSE_COL_WIDTHS = ["13%", "37%", "18%", "18%", "14%"];

export function ExpensesTable({ rows, currency, sort, puedeEditar }: {
  rows: ExpenseRow[]; currency: string; sort: { key: string; dir: SortDir }; puedeEditar: boolean;
}) {
  return <DataTable rows={rows} columns={columns(currency, puedeEditar)} rowKey={(r) => r.id} sort={sort} caption="Gastos" />;
}

/** La misma fila en el teléfono. */
export function ExpenseRowCard({ r, currency, puedeEditar }: { r: ExpenseRow; currency: string; puedeEditar: boolean }) {
  const cuerpo = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 flex-1 truncate font-medium text-[var(--text)]">{r.description}</p>
        <p className="shrink-0 font-semibold tabular-nums text-[var(--text)]">{formatMoney(r.amount, currency)}</p>
      </div>
      <p className="mt-1 truncate text-xs text-[var(--text-soft)]">
        {formatDateOnly(r.spentOn)} · {r.categoryName ?? "Sin categoría"}
        {r.supplier ? ` · ${r.supplier}` : ""}
        {r.fromRecurring ? " · gasto fijo" : ""}
      </p>
    </>
  );
  return puedeEditar
    ? <Link href={`/finanzas/gastos/${r.id}/editar`} className="block rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 transition-colors active:bg-[var(--bg)] lg:hidden">{cuerpo}</Link>
    : <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 lg:hidden">{cuerpo}</div>;
}
