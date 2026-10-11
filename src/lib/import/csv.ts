/** Lectura de CSV, con las rarezas que de verdad salen de un Excel.
 *
 *  - El Excel en español exporta con punto y coma, no con coma. Se detecta.
 *  - Guarda con BOM al principio del archivo; si no se quita, la primera cabecera
 *    deja de coincidir con nada.
 *  - Los saltos de línea dentro de una celda entrecomillada son parte del valor.
 *  - Las comillas dobles se escapan duplicándolas. */

const DELIMITADORES = [",", ";", "\t", "|"] as const;
export type Delimitador = (typeof DELIMITADORES)[number];

/** Qué separador usa el archivo. Gana el que produzca más columnas en la primera
 *  línea de verdad, contando solo lo que está fuera de comillas. */
export function detectarDelimitador(texto: string): Delimitador {
  const linea = primeraLinea(texto);
  let mejor: Delimitador = ",";
  let max = 0;
  for (const d of DELIMITADORES) {
    const n = contarFuera(linea, d);
    if (n > max) { max = n; mejor = d; }
  }
  return mejor;
}

function primeraLinea(texto: string): string {
  let dentro = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (c === '"') { dentro = !dentro; continue; }
    if (!dentro && (c === "\n" || c === "\r")) return texto.slice(0, i);
  }
  return texto;
}

function contarFuera(linea: string, d: string): number {
  let dentro = false, n = 0;
  for (let i = 0; i < linea.length; i++) {
    const c = linea[i];
    if (c === '"') { dentro = !dentro; continue; }
    if (!dentro && c === d) n++;
  }
  return n;
}

/** Texto CSV a matriz de celdas. Nunca lanza: un archivo raro devuelve lo que se pudo leer. */
export function parseCsv(texto: string, delimitador?: Delimitador): string[][] {
  // El BOM que escribe Excel al guardar en UTF-8.
  const limpio = texto.charCodeAt(0) === 0xfeff ? texto.slice(1) : texto;
  const d = delimitador ?? detectarDelimitador(limpio);

  const filas: string[][] = [];
  let fila: string[] = [];
  let celda = "";
  let dentro = false;

  for (let i = 0; i < limpio.length; i++) {
    const c = limpio[i];

    if (dentro) {
      if (c === '"') {
        if (limpio[i + 1] === '"') { celda += '"'; i++; }   // comilla escapada
        else dentro = false;
      } else celda += c;
      continue;
    }

    if (c === '"') { dentro = true; continue; }
    if (c === d) { fila.push(celda); celda = ""; continue; }
    if (c === "\r") { if (limpio[i + 1] === "\n") i++; filas.push([...fila, celda]); fila = []; celda = ""; continue; }
    if (c === "\n") { filas.push([...fila, celda]); fila = []; celda = ""; continue; }
    celda += c;
  }
  if (celda !== "" || fila.length > 0) filas.push([...fila, celda]);

  // Fuera las filas completamente vacías: Excel suele dejar una al final.
  return filas.filter((f) => f.some((v) => v.trim() !== ""));
}
