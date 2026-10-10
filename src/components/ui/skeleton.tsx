import type { ReactNode } from "react";

/** Bloque gris que late mientras llega el contenido. Decorativo: quien anuncia la espera
 *  es el `role="status"` del contenedor, una sola vez, no cada bloque. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-md bg-[var(--border)] ${className}`} />;
}

/** Envoltura de cualquier esqueleto: anuncia «Cargando…» una vez y nada más. */
export function Loading({ children, label = "Cargando…" }: { children: ReactNode; label?: string }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** Cabecera de módulo: título, subtítulo y los dos controles de la derecha. */
export function HeaderSkeleton() {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-6 w-44" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      <div className="flex shrink-0 gap-2"><Skeleton className="h-10 w-24" /><Skeleton className="h-10 w-32" /></div>
    </div>
  );
}

/** Barra de búsqueda y filtros. */
export function ToolbarSkeleton({ filters = 2 }: { filters?: number }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Skeleton className="h-9 min-w-[220px] flex-1" />
      {Array.from({ length: filters }, (_, i) => <Skeleton key={i} className="h-9 w-40" />)}
    </div>
  );
}

/** Tabla de lista: respeta los anchos de columna para que no salte nada al llegar los datos. */
export function TableSkeleton({ widths, rows = 8 }: { widths: string[]; rows?: number }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-2 lg:p-4">
      <div className="hidden lg:block">
        <div className="flex gap-3 border-b border-[var(--border)] pb-2">
          {widths.map((w, i) => <div key={i} style={{ width: w }}><Skeleton className="h-3 w-3/5" /></div>)}
        </div>
        {Array.from({ length: rows }, (_, r) => (
          <div key={r} className="flex gap-3 border-b border-[var(--border)] py-3">
            {widths.map((w, i) => <div key={i} style={{ width: w }}><Skeleton className="h-4 w-4/5" /></div>)}
          </div>
        ))}
      </div>
      <div className="space-y-2 lg:hidden">
        {Array.from({ length: Math.min(rows, 5) }, (_, r) => <Skeleton key={r} className="h-20 w-full rounded-xl" />)}
      </div>
    </div>
  );
}

/** Rejilla de fichas: KPIs del dashboard y de los reportes. */
export function CardsSkeleton({ count = 4, height = "h-28" }: { count?: number; height?: string }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: count }, (_, i) => <Skeleton key={i} className={`${height} w-full rounded-2xl`} />)}
    </div>
  );
}

/** Formulario de alta o edición. */
export function FormSkeleton({ fields = 6 }: { fields?: number }) {
  return (
    <div className="max-w-2xl space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      {Array.from({ length: fields }, (_, i) => (
        <div key={i} className="space-y-1.5"><Skeleton className="h-3 w-28" /><Skeleton className="h-10 w-full" /></div>
      ))}
      <div className="flex gap-2 pt-1"><Skeleton className="h-10 w-28" /><Skeleton className="h-10 w-24" /></div>
    </div>
  );
}
