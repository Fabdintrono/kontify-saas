import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";

export function ChartCard({ title, icon, empty, emptyHint, children }: {
  title: string; icon: LucideIcon; empty?: boolean; emptyHint?: string; children?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <p className="mb-2 text-sm font-bold text-[var(--text)]">{title}</p>
      {empty ? <EmptyState icon={icon} title="Aún sin datos" hint={emptyHint} /> : children}
    </div>
  );
}
