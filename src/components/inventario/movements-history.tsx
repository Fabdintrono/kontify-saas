import { formatDate } from "@/lib/format";
import { DANGER_TEXT } from "@/lib/ui-tokens";

type Movement = { id: string; type: string; qtyDelta: number; branchName: string | null; reason: string | null; createdAt: string };
const LABEL: Record<string, string> = { adjustment: "Ajuste", sale: "Venta", sale_void: "Anulación venta" };

export function MovementsHistory({ movements, tz }: { movements: Movement[]; tz: string }) {
  if (movements.length === 0) return <p className="text-sm text-[var(--text-soft)]">Sin movimientos.</p>;
  return (
    <ul className="divide-y divide-[var(--border)]">
      {movements.map((m) => (
        <li key={m.id} className="flex items-center justify-between py-2 text-sm">
          <span className="text-[var(--text)]">
            {LABEL[m.type] ?? m.type}
            <span className="ml-2 text-xs text-[var(--text-soft)]">
              {formatDate(m.createdAt, tz)}{m.branchName ? ` · ${m.branchName}` : ""}{m.reason ? ` · ${m.reason}` : ""}
            </span>
          </span>
          <span className={`font-semibold ${m.qtyDelta < 0 ? DANGER_TEXT : "text-[#0f766e] dark:text-[#6ee7b7]"}`}>
            {m.qtyDelta > 0 ? "+" : ""}{m.qtyDelta}
          </span>
        </li>
      ))}
    </ul>
  );
}
