/** Lectura de una fecha tal como sale de una hoja de cálculo.
 *
 *  Tres formas llegan de verdad:
 *   - «05/10/2026», «5/10/26», «05-10-2026»  → día primero, que es como se escribe aquí.
 *   - «2026-10-05»                            → la que ya viene normalizada.
 *   - «46000»                                 → el número de serie de Excel. El lector de
 *     .xlsx no interpreta estilos, así que una celda con formato de fecha llega como el
 *     número crudo de días desde el 30 de diciembre de 1899.
 *
 *  Devuelve siempre «YYYY-MM-DD», o null si no se reconoce. */

const EPOCA_EXCEL = Date.UTC(1899, 11, 30);
const SERIE_MIN = 1;         // 31/12/1899
const SERIE_MAX = 80_000;    // año 2119: más allá, es un número que no es una fecha

const iso = (a: number, m: number, d: number) =>
  `${String(a).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

function esDiaReal(a: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return d <= ultimo;
}

/** Un año de dos cifras: 00-69 es 2000-2069; 70-99 es 1970-1999. */
function anioCompleto(n: number): number {
  if (n >= 100) return n;
  return n <= 69 ? 2000 + n : 1900 + n;
}

export function parseFecha(bruto: string): string | null {
  const s = bruto.trim();
  if (s === "") return null;

  // Ya normalizada
  const m1 = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m1) {
    const [a, m, d] = [Number(m1[1]), Number(m1[2]), Number(m1[3])];
    return esDiaReal(a, m, d) ? iso(a, m, d) : null;
  }

  // Día primero, con barra, guion o punto
  const m2 = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (m2) {
    let d = Number(m2[1]), mes = Number(m2[2]);
    const a = anioCompleto(Number(m2[3]));
    // Si el primero no puede ser un día pero el segundo sí, vino al revés (mm/dd).
    // Con los dos por debajo de 13 manda la forma de aquí: día primero.
    if (d > 12 && mes <= 12) { /* día primero, inequívoco */ }
    else if (d <= 12 && mes > 12) { [d, mes] = [mes, d]; }
    return esDiaReal(a, mes, d) ? iso(a, mes, d) : null;
  }

  // Número de serie de Excel
  if (/^\d+(\.\d+)?$/.test(s)) {
    const n = Math.floor(Number(s));
    if (n < SERIE_MIN || n > SERIE_MAX) return null;
    const t = new Date(EPOCA_EXCEL + n * 86_400_000);
    return iso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
  }

  return null;
}
