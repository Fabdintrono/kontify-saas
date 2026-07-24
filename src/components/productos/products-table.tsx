import Link from "next/link";
import type { ProductListRow } from "@/lib/productos/queries";
import { formatMoney } from "@/lib/format";
import { CategoryBadge } from "./category-badge";

export function ProductsTable({ rows, currency }: { rows: ProductListRow[]; currency: string }) {
  return (
    <table className="hidden w-full text-sm lg:table">
      <thead>
        <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--text-soft)]">
          <th className="py-2 font-medium">Nombre</th><th className="font-medium">SKU</th>
          <th className="font-medium">Categoría</th><th className="font-medium">Precio</th><th className="font-medium">Estado</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className="border-b border-[var(--border)] hover:bg-[var(--bg)]">
            <td className="py-2.5">
              <Link href={`/operaciones/productos/${r.id}`} className="font-medium text-[var(--text)] hover:text-[#0e7490]">{r.name}</Link>
              <span className="ml-2 text-xs text-[var(--text-soft)]">{r.kind === "service" ? "Servicio" : "Bien"}</span>
            </td>
            <td className="text-[var(--text-soft)]">{r.sku || "—"}</td>
            <td><CategoryBadge name={r.categoryName} /></td>
            <td className="text-[var(--text)]">{formatMoney(r.price, currency)}</td>
            <td>{r.active
              ? <span className="text-xs font-medium text-[#0f766e] dark:text-[#6ee7b7]">Activo</span>
              : <span className="text-xs font-medium text-[var(--text-soft)]">Archivado</span>}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
