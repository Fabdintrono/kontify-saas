import Link from "next/link";
import type { ClientListRow } from "@/lib/clientes/queries";
import type { SortDir } from "@/lib/sorting";
import { formatMoney, formatDate } from "@/lib/format";
import { DataTable, type Column } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { TypeBadge } from "./type-badge";

function columns(currency: string, tz: string): Column<ClientListRow>[] {
  return [
    {
      key: "name", label: "Cliente", width: "30%", sortable: true, natural: "asc",
      cell: (r) => (
        <span className="flex min-w-0 items-center gap-2">
          <Link href={`/clientes/${r.id}`} className="truncate font-medium text-[var(--text)] transition-colors hover:text-[#0e7490] dark:hover:text-[#5eead4]">{r.name}</Link>
          <span className="shrink-0 text-xs text-[var(--text-soft)]">{r.kind === "company" ? "Empresa" : "Persona"}</span>
          {!r.active && <StatusBadge tone="neutral" label="Archivado" />}
        </span>
      ),
    },
    { key: "type", label: "Tipo", width: "14%", sortable: true, natural: "asc", cell: (r) => <TypeBadge name={r.typeName} /> },
    { key: "contact", label: "Contacto", width: "19%", cell: (r) => <span className="text-[var(--text-soft)]">{r.phone || r.email || "—"}</span> },
    {
      key: "orders", label: "Compras", width: "10%", align: "right", sortable: true, natural: "desc",
      cell: (r) => <span className={r.orders === 0 ? "text-[var(--text-soft)]" : "text-[var(--text)]"}>{r.orders || "—"}</span>,
    },
    {
      key: "spent", label: "Total comprado", width: "14%", align: "right", sortable: true, natural: "desc",
      cell: (r) => <span className={r.spent === 0 ? "text-[var(--text-soft)]" : "font-medium text-[var(--text)]"}>
        {r.spent === 0 ? "—" : formatMoney(r.spent, currency)}
      </span>,
    },
    {
      key: "lastOrder", label: "Última compra", width: "13%", sortable: true, natural: "desc",
      cell: (r) => <span className="text-[var(--text-soft)]">{r.lastOrderAt ? formatDate(r.lastOrderAt, tz) : "Nunca"}</span>,
    },
  ];
}

export const CLIENT_COL_WIDTHS = ["30%", "14%", "19%", "10%", "14%", "13%"];

export function ClientsTable({ rows, currency, tz, sort }: {
  rows: ClientListRow[]; currency: string; tz: string; sort: { key: string; dir: SortDir };
}) {
  return <DataTable rows={rows} columns={columns(currency, tz)} rowKey={(r) => r.id} sort={sort} caption="Clientes" />;
}
