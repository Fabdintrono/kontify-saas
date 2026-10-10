"use client";
import { useState } from "react";
import { CircleHelp } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import type { Guide } from "@/lib/guides";

/** Enlace «¿Cómo funciona?» que abre un panel lateral con los pasos del módulo.
 *  No se abre solo nunca (sin tours bloqueantes). Si la guía no tiene pasos, no renderiza nada. */
export function ModuleGuide({ guide, className }: { guide: Guide; className?: string }) {
  const [open, setOpen] = useState(false);
  if (guide.steps.length === 0) return null;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1 text-xs font-semibold text-[#0e7490] hover:underline dark:text-[#5eead4] ${className ?? ""}`}>
        <CircleHelp className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" /> ¿Cómo funciona?
      </button>
      <Sheet open={open} onOpenChange={setOpen} side="right" title={`¿Cómo funciona ${guide.title}?`}>
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
