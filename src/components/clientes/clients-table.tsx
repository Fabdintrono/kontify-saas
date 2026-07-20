import Link from "next/link";
import type { ClientListRow } from "@/lib/clientes/queries";
import { TypeBadge } from "./type-badge";

export function ClientsTable({ rows }: { rows: ClientListRow[] }) {
  return (
    <table className="hidden w-full text-sm lg:table">
      <thead>
        <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--text-soft)]">
          <th className="py-2 font-medium">Nombre</th><th className="font-medium">Tipo</th>
          <th className="font-medium">Contacto</th><th className="font-medium">Estado</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className="border-b border-[var(--border)] hover:bg-[var(--bg)]">
            <td className="py-2.5">
              <Link href={`/clientes/${r.id}`} className="font-medium text-[var(--text)] hover:text-[#0e7490]">{r.name}</Link>
              <span className="ml-2 text-xs text-[var(--text-soft)]">{r.kind === "company" ? "Empresa" : "Persona"}</span>
            </td>
            <td><TypeBadge name={r.typeName} /></td>
            <td className="text-[var(--text-soft)]">{r.phone || r.email || "—"}</td>
            <td>{r.active
              ? <span className="text-xs font-medium text-[#0f766e] dark:text-[#6ee7b7]">Activo</span>
              : <span className="text-xs font-medium text-[var(--text-soft)]">Archivado</span>}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
