import Link from "next/link";
import type { StockRow } from "@/lib/inventario/queries";
import { StockStatusBadge } from "./stock-status-badge";

export function StockRowCard({ r }: { r: StockRow }) {
  return (
    <Link href={`/operaciones/productos/${r.productId}`}
      className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 lg:hidden">
      <div className="min-w-0">
        <p className="truncate font-medium text-[var(--text)]">{r.name}</p>
        <p className="truncate text-xs text-[var(--text-soft)]">{r.sku || "—"} · existencia {r.qty}</p>
      </div>
      <StockStatusBadge status={r.status} />
    </Link>
  );
}
