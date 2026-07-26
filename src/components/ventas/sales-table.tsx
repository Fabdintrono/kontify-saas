import Link from "next/link";
import type { SaleListRow } from "@/lib/ventas/queries";
import { formatMoney } from "@/lib/format";
import { SaleStatusBadge } from "./status-badge";

export function SalesTable({ rows }: { rows: SaleListRow[] }) {
  return (
    <table className="hidden w-full text-sm lg:table">
      <thead>
        <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--text-soft)]">
          <th className="py-2 font-medium">Nº</th><th className="font-medium">Fecha</th><th className="font-medium">Cliente</th>
          <th className="font-medium">Total</th><th className="font-medium">Saldo</th><th className="font-medium">Estado</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className="border-b border-[var(--border)] hover:bg-[var(--bg)]">
            <td className="py-2.5">
              <Link href={`/operaciones/facturacion/${r.id}`} className="font-medium text-[var(--text)] hover:text-[#0e7490]">
                {r.number != null ? `#${r.number}` : "—"}
              </Link>
            </td>
            <td className="text-[var(--text-soft)]">{new Date(r.issuedAt ?? r.createdAt).toLocaleDateString("es-VE")}</td>
            <td className="text-[var(--text)]">{r.clientName ?? "Consumidor final"}</td>
            <td className="text-[var(--text)]">{formatMoney(r.total, r.currency)}</td>
            <td className={r.balance > 0 ? "text-[#dc2626]" : "text-[var(--text-soft)]"}>{formatMoney(r.balance, r.currency)}</td>
            <td><SaleStatusBadge status={r.status} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
