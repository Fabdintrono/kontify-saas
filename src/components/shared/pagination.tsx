import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** Paginación de lista. Conserva todos los parámetros en curso (búsqueda, filtros y orden)
 *  y solo cambia `page`: cambiar de página nunca pierde lo que el usuario había elegido. */
export function Pagination({ basePath, params, page, pages }: {
  basePath: string;
  params: Record<string, string | undefined>;
  page: number;
  pages: number;
}) {
  if (pages <= 1) return null;

  function href(target: number): string {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v && k !== "page") sp.set(k, v);
    sp.set("page", String(target));
    return `${basePath}?${sp.toString()}`;
  }

  const cls = "grid h-9 w-9 place-items-center rounded-lg border border-[var(--border)] text-[var(--text)] transition-colors hover:bg-[var(--bg)]";
  return (
    <nav aria-label="Paginación" className="flex items-center justify-end gap-2 text-sm">
      {page <= 1
        ? <span className={`${cls} opacity-40`} aria-disabled="true"><ChevronLeft className="h-4 w-4" aria-hidden="true" /></span>
        : <Link href={href(page - 1)} aria-label="Página anterior" className={cls}><ChevronLeft className="h-4 w-4" aria-hidden="true" /></Link>}
      <span className="text-[var(--text-soft)]" aria-current="page">Página {page} de {pages}</span>
      {page >= pages
        ? <span className={`${cls} opacity-40`} aria-disabled="true"><ChevronRight className="h-4 w-4" aria-hidden="true" /></span>
        : <Link href={href(page + 1)} aria-label="Página siguiente" className={cls}><ChevronRight className="h-4 w-4" aria-hidden="true" /></Link>}
    </nav>
  );
}
