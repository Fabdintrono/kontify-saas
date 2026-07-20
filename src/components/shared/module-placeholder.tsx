import type { LucideIcon } from "lucide-react";
import { Hammer } from "lucide-react";
import { EmptyState } from "./empty-state";

export function ModulePlaceholder({ title, icon }: { title: string; icon?: LucideIcon }) {
  return (
    <div className="p-6">
      <h1 className="text-xl font-extrabold tracking-[-0.4px] text-[var(--text)]">{title}</h1>
      <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        <EmptyState icon={icon ?? Hammer} title="Este módulo llega pronto"
          hint="Lo estamos construyendo. Llegará en una próxima versión de Kontify." />
      </div>
    </div>
  );
}
