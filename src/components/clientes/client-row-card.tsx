import Link from "next/link";
import type { ClientListRow } from "@/lib/clientes/queries";
import { TypeBadge } from "./type-badge";

export function ClientRowCard({ r }: { r: ClientListRow }) {
  return (
    <Link href={`/clientes/${r.id}`}
      className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 lg:hidden">
      <div className="min-w-0">
        <p className="truncate font-medium text-[var(--text)]">{r.name}</p>
        <p className="truncate text-xs text-[var(--text-soft)]">{r.phone || r.email || "—"}</p>
      </div>
      <div className="flex flex-none items-center gap-2">
        <TypeBadge name={r.typeName} />
        {!r.active && <span className="text-xs text-[var(--text-soft)]">Archivado</span>}
      </div>
    </Link>
  );
}
