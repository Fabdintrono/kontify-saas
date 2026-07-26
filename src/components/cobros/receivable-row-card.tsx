import Link from "next/link";
import type { ReceivableClientRow } from "@/lib/cobros/queries";
import { formatMoney } from "@/lib/format";

export function ReceivableRowCard({ r, currency }: { r: ReceivableClientRow; currency: string }) {
  const inner = (
    <div className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 lg:hidden">
      <div className="min-w-0">
        <p className="truncate font-medium text-[var(--text)]">{r.name}</p>
        <p className="truncate text-xs text-[var(--text-soft)]">
          {formatMoney(r.totalDue, currency)}{r.overdueAmount > 0 ? ` · vencido ${formatMoney(r.overdueAmount, currency)}` : ""}
        </p>
      </div>
    </div>
  );
  return r.clientId ? <Link href={`/finanzas/cuentas-por-cobrar/${r.clientId}`}>{inner}</Link> : inner;
}
