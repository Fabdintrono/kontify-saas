import type { ReactNode } from "react";
import { DANGER_TEXT } from "@/lib/ui-tokens";

/** Geometría y estados de todo campo de texto, número, selector o área.
 *
 *  Antes cada formulario traía su propia cadena de clases con `outline-none` y solo
 *  un cambio de color de borde al enfocar: eso no alcanza el contraste que pide el
 *  foco visible. El anillo lo pone ahora `globals.css` para todo el documento; aquí
 *  queda la forma, el estado de error y el de deshabilitado. */
export const FIELD =
  "w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)] " +
  "transition-colors duration-150 placeholder:text-[var(--text-soft)] " +
  "hover:border-[var(--text-soft)]/40 disabled:cursor-not-allowed disabled:opacity-60";

/** Campo en error: borde rojo, y el mensaje va debajo atado por `aria-describedby`. */
export const FIELD_ERROR = "border-[#b91c1c] dark:border-[#f87171]";

export function fieldCls(hasError?: boolean, extra = ""): string {
  return `${FIELD} ${hasError ? FIELD_ERROR : ""} ${extra}`.trim();
}

/** Celda de una tabla editable: el constructor de líneas de una venta o un presupuesto.
 *  Más apretada que un campo de formulario porque van varias por fila. */
export const FIELD_CELL =
  "w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm text-[var(--text)] " +
  "transition-colors duration-150 hover:border-[var(--text-soft)]/40";

/** Campo de una sola línea con alto fijo, para cuando acompaña a un botón en la misma fila. */
export const FIELD_H10 =
  "h-10 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text)] " +
  "transition-colors duration-150 hover:border-[var(--text-soft)]/40";

/** Versión compacta de 36 px para barras de filtro, donde el campo acompaña y no manda. */
export const FIELD_SM =
  "h-9 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 text-sm text-[var(--text)] " +
  "transition-colors duration-150 hover:border-[var(--text-soft)]/40";

/** Envoltura de un campo: etiqueta arriba, ayuda debajo de la etiqueta, error debajo
 *  del control. Conecta las tres piezas con `aria-describedby` y marca `aria-invalid`. */
export function Field({ id, label, hint, error, children }: {
  id: string; label: ReactNode; hint?: string; error?: string; children: (props: {
    id: string; "aria-describedby": string | undefined; "aria-invalid": true | undefined;
  }) => ReactNode;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errId].filter(Boolean).join(" ") || undefined;
  return (
    <div>
      {label}
      {hint && <p id={hintId} className="mb-1.5 text-xs text-[var(--text-soft)]">{hint}</p>}
      {children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })}
      {error && <p id={errId} className={`mt-1 text-xs ${DANGER_TEXT}`}>{error}</p>}
    </div>
  );
}
