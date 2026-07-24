import Link from "next/link";
import type { ProductListRow } from "@/lib/productos/queries";
import { formatMoney } from "@/lib/format";
import { CategoryBadge } from "./category-badge";

export function ProductRowCard({ r, currency }: { r: ProductListRow; currency: string }) {
  return (
    <Link href={`/operaciones/productos/${r.id}`}
      className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 lg:hidden">
      <div className="min-w-0">
        <p className="truncate font-medium text-[var(--text)]">{r.name}</p>
        <p className="truncate text-xs text-[var(--text-soft)]">{r.sku || "—"} · {formatMoney(r.price, currency)}</p>
      </div>
      <div className="flex flex-none items-center gap-2">
        <CategoryBadge name={r.categoryName} />
        {!r.active && <span className="text-xs text-[var(--text-soft)]">Archivado</span>}
      </div>
    </Link>
  );
}
