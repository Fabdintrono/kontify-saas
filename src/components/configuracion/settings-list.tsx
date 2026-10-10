import type { ReactNode } from "react";

/** Lista de ajustes a ancho completo: una fila por registro, los campos a la izquierda
 *  y los botones pegados a la derecha. Antes vivían en una columna de 512 px pegada al
 *  borde izquierdo, con dos tercios de pantalla vacíos. */
export function SettingsList({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
      {/* Dos rótulos, uno por grupo: los campos crecen y las acciones quedan a la derecha.
          Una cabecera por columna no cuadraría, porque cada fila es un formulario. */}
      <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-2.5 text-xs font-medium text-[var(--text-soft)]">
        <span>{label}</span><span>Acciones</span>
      </div>
      <ul className="divide-y divide-[var(--border)]">{children}</ul>
    </div>
  );
}

/** Una fila: `fields` crece y ocupa el ancho; `actions` queda a la derecha. */
export function SettingsRow({ fields, actions }: { fields: ReactNode; actions: ReactNode }) {
  return (
    <li className="flex flex-wrap items-center gap-2 px-4 py-3 transition-colors hover:bg-[var(--bg)]">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{fields}</div>
      <div className="flex shrink-0 items-center gap-2">{actions}</div>
    </li>
  );
}

/** Formulario de alta, también a ancho completo. */
export function SettingsCreate({ action, children }: {
  action: (fd: FormData) => void | Promise<void>; children: ReactNode;
}) {
  return (
    <form action={action} className="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
      {children}
    </form>
  );
}

export const SETTINGS_INPUT =
  "h-10 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text)] outline-none transition-colors focus:border-[#0e7490]";
