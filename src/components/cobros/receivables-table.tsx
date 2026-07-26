import Link from "next/link";
import type { ReceivableClientRow } from "@/lib/cobros/queries";
import { formatMoney } from "@/lib/format";

export function ReceivablesTable({ rows, currency }: { rows: ReceivableClientRow[]; currency: string }) {
  return (
    <table className="hidden w-full text-sm lg:table">
      <thead>
        <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--text-soft)]">
          <th className="py-2 font-medium">Cliente</th><th className="font-medium">Total adeudado</th>
          <th className="font-medium">Vencido</th><th className="font-medium">Vto. más antiguo</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.clientId ?? "none"} className="border-b border-[var(--border)] hover:bg-[var(--bg)]">
            <td className="py-2.5">
              {r.clientId
                ? <Link href={`/finanzas/cuentas-por-cobrar/${r.clientId}`} className="font-medium text-[var(--text)] hover:text-[#0e7490]">{r.name}</Link>
                : <span className="text-[var(--text-soft)]">{r.name}</span>}
            </td>
            <td className="text-[var(--text)]">{formatMoney(r.totalDue, currency)}</td>
            <td className={r.overdueAmount > 0 ? "text-[#dc2626]" : "text-[var(--text-soft)]"}>{r.overdueAmount > 0 ? formatMoney(r.overdueAmount, currency) : "—"}</td>
            <td className="text-[var(--text-soft)]">{r.oldestDueDate ? new Date(r.oldestDueDate).toLocaleDateString("es-VE") : "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
