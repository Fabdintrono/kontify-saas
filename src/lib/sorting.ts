export type SortDir = "asc" | "desc";

/** Una columna ordenable: a qué columna de base de datos apunta y hacia dónde ordena
 *  la primera vez que se pulsa (texto hacia arriba, cifras y fechas hacia abajo). */
export type SortColumn = { column: string; natural: SortDir; nullsFirst?: boolean };

export type SortSpec = {
  default: { key: string; dir: SortDir };
  columns: Record<string, SortColumn>;
};

export type ResolvedSort = { key: string; dir: SortDir; column: string; ascending: boolean; nullsFirst?: boolean };

/** Traduce lo que llega por URL a una orden segura.
 *  Lo que no esté en `spec.columns` cae al defecto COMPLETO, dirección incluida: una
 *  columna que no existe no es media orden válida, así que tampoco manda su `dir`.
 *  Nada escrito por el usuario llega crudo a `.order()`. */
export function resolveSort(spec: SortSpec, key: string | undefined, dir: string | undefined): ResolvedSort {
  const known = !!key && Object.prototype.hasOwnProperty.call(spec.columns, key);
  const k = known ? key! : spec.default.key;
  const col = spec.columns[k];
  const d: SortDir = known && (dir === "asc" || dir === "desc")
    ? dir
    : (known ? (col?.natural ?? spec.default.dir) : spec.default.dir);
  return { key: k, dir: d, column: col?.column ?? k, ascending: d === "asc", nullsFirst: col?.nullsFirst };
}

/** Qué par (sort, dir) toca al pulsar `clicked`: invertir si ya era la activa,
 *  o estrenarla con su dirección natural. */
export function nextSortParams(
  spec: SortSpec,
  current: { key: string; dir: SortDir },
  clicked: string,
): { sort: string; dir: SortDir } {
  if (!Object.prototype.hasOwnProperty.call(spec.columns, clicked)) return { sort: current.key, dir: current.dir };
  if (clicked === current.key) return { sort: clicked, dir: current.dir === "asc" ? "desc" : "asc" };
  return { sort: clicked, dir: spec.columns[clicked].natural };
}

/** La misma decisión que `nextSortParams`, pero con solo la dirección natural de la
 *  columna pulsada. La usa la cabecera en el cliente, que no recibe el `SortSpec`. */
export function toggleDir(current: { key: string; dir: SortDir } | null, clicked: string, natural: SortDir): SortDir {
  if (current && current.key === clicked) return current.dir === "asc" ? "desc" : "asc";
  return natural;
}

/** Comparador en memoria para las listas que no pagina el servidor.
 *  Los valores vacíos van siempre al final, ordene hacia donde ordene. */
export function compareBy<T>(rows: T[], pick: (r: T) => string | number | null, ascending: boolean): T[] {
  const sign = ascending ? 1 : -1;
  return [...rows].sort((a, b) => {
    const x = pick(a), y = pick(b);
    if (x === null && y === null) return 0;
    if (x === null) return 1;
    if (y === null) return -1;
    if (typeof x === "number" && typeof y === "number") return (x - y) * sign;
    return String(x).localeCompare(String(y), "es", { numeric: true, sensitivity: "base" }) * sign;
  });
}
