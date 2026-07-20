import { CircleCheck, TriangleAlert } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";

export type AttentionItem = { title: string; detail: string; tone: "warn" | "danger" | "info" };

export function AttentionList({ items }: { items: AttentionItem[] }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <p className="mb-2 text-sm font-bold text-[var(--text)]">Requieren atención</p>
      {items.length === 0 ? (
        <EmptyState icon={CircleCheck} title="Todo en orden" hint="No hay nada pendiente por ahora." />
      ) : (
        <ul className="space-y-2">
          {items.map((it, i) => (
            <li key={i} className="flex items-start gap-2 rounded-lg border border-[var(--border)] p-2.5">
              <TriangleAlert className="mt-0.5 h-4 w-4 text-[#b45309] dark:text-[#fbbf24]" strokeWidth={2} />
              <div>
                <p className="text-sm font-semibold text-[var(--text)]">{it.title}</p>
                <p className="text-xs text-[var(--text-soft)]">{it.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
