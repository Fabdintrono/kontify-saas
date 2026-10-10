import Link from "next/link";
import type { ClientListRow } from "@/lib/clientes/queries";
import { formatMoney, formatDate } from "@/lib/format";
import { StatusBadge } from "@/components/ui/status-badge";
import { TypeBadge } from "./type-badge";

/** La misma fila en el teléfono. Lleva lo comercial, que es lo que se consulta de pie
 *  frente al cliente: cuánto ha comprado y cuándo fue la última vez. */
export function ClientRowCard({ r, currency, tz }: { r: ClientListRow; currency: string; tz: string }) {
  return (
    <Link href={`/clientes/${r.id}`}
      className="block rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 transition-colors active:bg-[var(--bg)] lg:hidden">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium text-[var(--text)]">{r.name}</p>
          <p className="truncate text-xs text-[var(--text-soft)]">{r.phone || r.email || "Sin contacto"}</p>
        </div>
        <div className="flex flex-none items-center gap-1.5">
          <TypeBadge name={r.typeName} />
          {!r.active && <StatusBadge tone="neutral" label="Archivado" />}
        </div>
      </div>
      <p className="mt-2 text-xs text-[var(--text-soft)]">
        {r.orders === 0
          ? "Todavía no te ha comprado"
          : <>{r.orders} {r.orders === 1 ? "compra" : "compras"} · {formatMoney(r.spent, currency)} · última el {formatDate(r.lastOrderAt!, tz)}</>}
      </p>
    </Link>
  );
}
