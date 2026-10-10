"use client";
import { useState } from "react";
import { CircleHelp } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { buttonCls } from "@/components/ui/button";
import type { Guide } from "@/lib/guides";

/** Ayuda del módulo: abre un panel lateral con los pasos. No se abre nunca sola.
 *
 *  `variant="button"` es la de la cabecera: primer control del grupo de la derecha en
 *  los 13 módulos, siempre en el mismo sitio (WCAG 2.2 · 3.2.6 Ayuda coherente).
 *  `variant="link"` es la del estado vacío, donde sí conviene que se lea como frase. */
export function ModuleGuide({ guide, className, variant = "link" }: {
  guide: Guide; className?: string; variant?: "link" | "button";
}) {
  const [open, setOpen] = useState(false);
  if (guide.steps.length === 0) return null;

  const trigger = variant === "button" ? (
    <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open}
      aria-label="Cómo funciona" className={buttonCls("secondary", className)}>
      <CircleHelp className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
      <span className="hidden sm:inline">Ayuda</span>
    </button>
  ) : (
    <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open}
      className={`inline-flex items-center gap-1 text-xs font-semibold text-[#0e7490] transition-colors hover:underline dark:text-[#5eead4] ${className ?? ""}`}>
      <CircleHelp className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" /> ¿Cómo funciona?
    </button>
  );

  return (
    <>
      {trigger}
      <Sheet open={open} onOpenChange={setOpen} side="right" title={`Cómo funciona: ${guide.title}`}>
        <p className="mb-4 text-sm text-[var(--text-soft)]">{guide.subtitle}</p>
        <ol className="space-y-3">
          {guide.steps.map((s, i) => (
            <li key={i} className="flex gap-3 text-sm text-[var(--text)]">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#0e7490]/10 text-xs font-bold text-[#0e7490] dark:text-[#5eead4]">{i + 1}</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
        {guide.notDoes && guide.notDoes.length > 0 && (
          <div className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3">
            <p className="mb-1 text-xs font-bold uppercase tracking-wide text-[var(--text-soft)]">Lo que no hace</p>
            <ul className="space-y-1">
              {guide.notDoes.map((n, i) => <li key={i} className="text-sm text-[var(--text)]">{n}</li>)}
            </ul>
          </div>
        )}
      </Sheet>
    </>
  );
}
