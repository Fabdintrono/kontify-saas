import type { ReactNode } from "react";
import { FieldHelp } from "./field-help";
import type { FieldHelpKey } from "@/lib/field-help";

/** Etiqueta de campo asociada por `htmlFor` y, si procede, con un «?» de ayuda. */
export function FieldLabel({ htmlFor, help, children }: { htmlFor: string; help?: FieldHelpKey; children: ReactNode }) {
  return (
    <div className="mb-1 flex items-center gap-1.5">
      <label htmlFor={htmlFor} className="block text-xs font-medium text-[var(--text-soft)]">{children}</label>
      {help && <FieldHelp help={help} label={String(children).replace(/\s*\*$/, "")} />}
    </div>
  );
}
