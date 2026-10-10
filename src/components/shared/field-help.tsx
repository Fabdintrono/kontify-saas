"use client";
import * as PO from "@radix-ui/react-popover";
import { CircleHelp } from "lucide-react";
import { FIELD_HELP, type FieldHelpKey } from "@/lib/field-help";

/** «?» junto a una etiqueta. Popover (no tooltip de hover): funciona con teclado y en pantallas táctiles. */
export function FieldHelp({ help, label }: { help: FieldHelpKey; label: string }) {
  return (
    <PO.Root>
      <PO.Trigger asChild>
        <button type="button" aria-label={`Ayuda sobre ${label}`}
          className="grid h-4 w-4 place-items-center rounded-full text-[var(--text-soft)] hover:text-[#0e7490] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0e7490]">
          <CircleHelp className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
        </button>
      </PO.Trigger>
      <PO.Portal>
        <PO.Content side="top" align="start" sideOffset={6}
          className="z-50 max-w-xs rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-xs leading-relaxed text-[var(--text)] shadow-lg">
          {FIELD_HELP[help]}
          <PO.Arrow className="fill-[var(--surface)]" />
        </PO.Content>
      </PO.Portal>
    </PO.Root>
  );
}
