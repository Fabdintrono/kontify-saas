import Link from "next/link";
import type { ClientListRow } from "@/lib/clientes/queries";
import type { SortDir } from "@/lib/sorting";
import { DataTable, type Column } from "@/components/ui/data-table";
import { TypeBadge } from "./type-badge";

const COLUMNS: Column<ClientListRow>[] = [
  {
    key: "name", label: "Nombre", width: "40%", sortable: true, natural: "asc",
    cell: (r) => (
      <>
        <Link href={`/clientes/${r.id}`} className="font-medium text-[var(--text)] transition-colors hover:text-[#0e7490] dark:hover:text-[#5eead4]">{r.name}</Link>
        <span className="ml-2 text-xs text-[var(--text-soft)]">{r.kind === "company" ? "Empresa" : "Persona"}</span>
      </>
    ),
  },
  { key: "type", label: "Tipo", width: "18%", sortable: true, natural: "asc", cell: (r) => <TypeBadge name={r.typeName} /> },
  { key: "contact", label: "Contacto", width: "26%", cell: (r) => <span className="text-[var(--text-soft)]">{r.phone || r.email || "—"}</span> },
  {
    key: "status", label: "Estado", width: "16%", sortable: true, natural: "desc",
    cell: (r) => r.active
      ? <span className="text-xs font-medium text-[#0f766e] dark:text-[#6ee7b7]">Activo</span>
      : <span className="text-xs font-medium text-[var(--text-soft)]">Archivado</span>,
  },
];

/** Mismo reparto que usa el esqueleto, para que nada salte al llegar los datos. */
export const CLIENT_COL_WIDTHS = COLUMNS.map((c) => c.width);

export function ClientsTable({ rows, sort }: { rows: ClientListRow[]; sort: { key: string; dir: SortDir } }) {
  return <DataTable rows={rows} columns={COLUMNS} rowKey={(r) => r.id} sort={sort} caption="Clientes" />;
}
