import type { ReactNode } from "react";
import { SortHeader } from "./sort-header";
import type { SortDir } from "@/lib/sorting";

export type Align = "left" | "right" | "center";

export type Column<T> = {
  /** Clave de orden; única en la tabla y presente en el SortSpec del módulo si es ordenable. */
  key: string;
  label: string;
  /** Porcentaje del ancho de la tabla. Entre todas las columnas deben sumar 100. */
  width: string;
  align?: Align;
  /** Dirección con la que estrena al pulsarla. Obligatoria si `sortable`. */
  natural?: SortDir;
  sortable?: boolean;
  cell: (row: T) => ReactNode;
};

const ALIGN: Record<Align, string> = {
  left: "text-left",
  right: "text-right tabular-nums",
  center: "text-center",
};

/** Tabla de lista única de Kontify.
 *
 *  El `<colgroup>` reparte el ancho de forma explícita. Con `table-layout: auto` el
 *  sobrante se amontonaba al final de la fila y el contenido quedaba pegado al borde
 *  izquierdo con un hueco muerto a la derecha.
 *
 *  Se oculta bajo `lg`: en teléfono manda la ficha por fila de cada módulo. */
export function DataTable<T>({ rows, columns, rowKey, sort, caption }: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  sort?: { key: string; dir: SortDir };
  /** Resumen para lector de pantalla; no se pinta. */
  caption?: string;
}) {
  return (
    <div className="hidden overflow-x-auto lg:block">
      <table className="w-full text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <colgroup>{columns.map((c) => <col key={c.key} style={{ width: c.width }} />)}</colgroup>
        <thead>
          <tr className="border-b border-[var(--border)] text-xs text-[var(--text-soft)]">
            {columns.map((c) => {
              const active = !!c.sortable && sort?.key === c.key;
              const align = c.align ?? "left";
              return (
                <th key={c.key} scope="col"
                  aria-sort={!c.sortable ? undefined : active ? (sort!.dir === "asc" ? "ascending" : "descending") : "none"}
                  className={`sticky top-0 z-10 bg-[var(--surface)] px-3 py-2 font-medium ${ALIGN[align]}`}>
                  {c.sortable
                    ? <SortHeader columnKey={c.key} label={c.label} align={align}
                        natural={c.natural ?? "asc"} active={active} dir={active ? sort!.dir : null} />
                    : c.label}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={rowKey(r)} className="border-b border-[var(--border)] transition-colors hover:bg-[var(--bg)]">
              {columns.map((c) => (
                <td key={c.key} className={`px-3 py-2.5 ${ALIGN[c.align ?? "left"]}`}>{c.cell(r)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
