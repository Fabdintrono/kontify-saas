import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/** Cabecera de un formulario: volver, título y una línea de qué se está haciendo.
 *  El «volver» es un enlace real, no un `history.back()`: funciona abriendo en otra
 *  pestaña y el usuario ve a dónde va antes de pulsar. */
export function FormHeader({ backHref, backLabel, title, subtitle }: {
  backHref: string; backLabel: string; title: string; subtitle?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Link href={backHref}
        className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--text-soft)] transition-colors hover:text-[var(--text)]">
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" /> {backLabel}
      </Link>
      <h1 className="text-xl font-extrabold tracking-[-0.4px] text-[var(--text)]">{title}</h1>
      {subtitle && <p className="max-w-3xl text-sm text-[var(--text-soft)]">{subtitle}</p>}
    </div>
  );
}

/** Reparto del formulario: los campos ocupan el ancho disponible y la ayuda vive en una
 *  columna propia que se queda a la vista al desplazar. Debajo de `lg` la ayuda pasa
 *  arriba del todo, que es donde sirve a quien llega por primera vez. */
export function FormLayout({ aside, children }: { aside?: ReactNode; children: ReactNode }) {
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
      {aside && <aside className="order-first lg:order-last lg:sticky lg:top-5">{aside}</aside>}
      <div className="min-w-0 space-y-5">{children}</div>
    </div>
  );
}

/** Un bloque del formulario, con su título y, si hace falta, una línea que explica
 *  para qué sirve ese grupo de campos. Agrupar por significado es lo que convierte
 *  una lista de veinte casillas en algo que se entiende de un vistazo. */
export function FormSection({ title, hint, children }: {
  title: string; hint?: string; children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
      <div className="mb-4">
        <h2 className="text-sm font-bold text-[var(--text)]">{title}</h2>
        {hint && <p className="mt-0.5 text-xs text-[var(--text-soft)]">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

/** Rejilla de campos. En teléfono siempre una columna. */
export function FormGrid({ cols = 2, children }: { cols?: 1 | 2 | 3; children: ReactNode }) {
  const g = cols === 1 ? "" : cols === 3 ? "sm:grid-cols-2 xl:grid-cols-3" : "sm:grid-cols-2";
  return <div className={`grid gap-4 ${g}`}>{children}</div>;
}

/** Un campo que ocupa toda la fila dentro de una rejilla. */
export function FormWide({ children }: { children: ReactNode }) {
  return <div className="sm:col-span-2 xl:col-span-3">{children}</div>;
}

/** Barra de acciones pegada al fondo: con el formulario largo, guardar siempre está
 *  a la vista y no hay que buscar el final de la página. Cancelar a la izquierda,
 *  la acción principal a la derecha. */
export function FormActions({ cancelHref, children, note }: {
  cancelHref: string; children: ReactNode; note?: string;
}) {
  return (
    <div className="sticky bottom-0 -mx-4 mt-1 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] bg-[var(--surface)] px-4 py-3 sm:-mx-6 sm:px-6">
      <p className="text-xs text-[var(--text-soft)]">{note ?? "Los campos con * son obligatorios."}</p>
      <div className="flex items-center gap-2">
        <Link href={cancelHref}
          className="inline-flex h-10 items-center rounded-[10px] px-3 text-sm font-medium text-[var(--text-soft)] transition-colors hover:bg-[var(--bg)] hover:text-[var(--text)]">
          Cancelar
        </Link>
        {children}
      </div>
    </div>
  );
}

/** Ayuda al lado del formulario: para qué sirve esta pantalla y qué pasa al guardar.
 *  Pensada para quien viene de una hoja de cálculo y no sabe qué esperar. */
export function FormAside({ title, items, footer }: {
  title: string; items: string[]; footer?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-4">
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--text-soft)]">{title}</p>
      <ul className="space-y-2">
        {items.map((t, i) => (
          <li key={i} className="flex gap-2 text-xs leading-relaxed text-[var(--text)]">
            <span aria-hidden="true" className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#0e7490] dark:bg-[#5eead4]" />
            <span>{t}</span>
          </li>
        ))}
      </ul>
      {footer && <div className="mt-3">{footer}</div>}
    </div>
  );
}
