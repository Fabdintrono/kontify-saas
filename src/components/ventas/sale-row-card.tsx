import Link from "next/link";
import type { SaleListRow } from "@/lib/ventas/queries";
import { formatMoney } from "@/lib/format";
import { SaleStatusBadge } from "./status-badge";

export function SaleRowCard({ r }: { r: SaleListRow }) {
  return (
    <Link href={`/operaciones/facturacion/${r.id}`}
      className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 lg:hidden">
      <div className="min-w-0">
        <p className="truncate font-medium text-[var(--text)]">
          {r.number != null ? `#${r.number}` : "Borrador"} · {r.clientName ?? "Consumidor final"}
        </p>
        <p className="truncate text-xs text-[var(--text-soft)]">
          {formatMoney(r.total, r.currency)}{r.balance > 0 ? ` · saldo ${formatMoney(r.balance, r.currency)}` : ""}
        </p>
      </div>
      <SaleStatusBadge status={r.status} />
    </Link>
  );
}
