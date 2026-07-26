import Link from "next/link";
import type { StockRow } from "@/lib/inventario/queries";
import { StockStatusBadge } from "./stock-status-badge";

export function StockTable({ rows }: { rows: StockRow[] }) {
  return (
    <table className="hidden w-full text-sm lg:table">
      <thead>
        <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--text-soft)]">
          <th className="py-2 font-medium">Producto</th><th className="font-medium">SKU</th>
          <th className="font-medium">Existencia</th><th className="font-medium">Mínimo</th><th className="font-medium">Estado</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.productId} className="border-b border-[var(--border)] hover:bg-[var(--bg)]">
            <td className="py-2.5">
              <Link href={`/operaciones/productos/${r.productId}`} className="font-medium text-[var(--text)] hover:text-[#0e7490]">{r.name}</Link>
            </td>
            <td className="text-[var(--text-soft)]">{r.sku || "—"}</td>
            <td className={r.qty <= 0 ? "text-[#dc2626]" : "text-[var(--text)]"}>{r.qty}</td>
            <td className="text-[var(--text-soft)]">{r.minStock}</td>
            <td><StockStatusBadge status={r.status} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
