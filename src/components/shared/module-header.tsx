import type { ReactNode } from "react";
import { GUIDES, type ModuleId } from "@/lib/guides";
import { ModuleGuide } from "./module-guide";

/** Cabecera estándar de módulo: título · subtítulo de una línea · «¿Cómo funciona?» · acciones a la derecha. */
export function ModuleHeader({ module, title, subtitle, actions }: {
  module: ModuleId; title?: string; subtitle?: string | null; actions?: ReactNode;
}) {
  const g = GUIDES[module];
  const sub = subtitle === undefined ? g.subtitle : subtitle;
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-extrabold tracking-[-0.4px] text-[var(--text)]">{title ?? g.title}</h1>
        {sub ? (
          <p className="mt-0.5 max-w-3xl text-sm text-[var(--text-soft)]">{sub} <ModuleGuide guide={g} /></p>
        ) : (
          <ModuleGuide guide={g} className="mt-0.5" />
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
