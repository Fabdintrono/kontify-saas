import { parseCsv } from "./csv";
import { parseXlsx } from "./xlsx";

export const EXTENSIONES = [".xlsx", ".csv", ".txt"] as const;
export const TAMANO_MAXIMO = 5 * 1024 * 1024;   // 5 MB: de sobra para decenas de miles de filas
export const FILAS_MAXIMAS = 5000;

export type Hoja = { cabeceras: string[]; filas: string[][] };

/** Lee un archivo subido y devuelve cabeceras y filas, venga de Excel o de un CSV.
 *
 *  Lanza con un mensaje que se le puede enseñar al usuario tal cual: aquí el error
 *  no es un fallo del programa, es parte del flujo. */
export function leerHoja(bytes: Buffer, nombreArchivo: string): Hoja {
  const ext = nombreArchivo.toLowerCase().slice(nombreArchivo.lastIndexOf("."));
  if (bytes.length === 0) throw new Error("El archivo está vacío.");
  if (bytes.length > TAMANO_MAXIMO) throw new Error("El archivo pesa más de 5 MB. Divídelo en varios.");

  const matriz = ext === ".xlsx"
    ? parseXlsx(bytes)
    : parseCsv(bytes.toString("utf8"));

  if (matriz.length === 0) throw new Error("No se encontró ninguna fila con datos.");
  const [cabeceras, ...filas] = matriz;
  if (filas.length === 0) throw new Error("El archivo solo trae la fila de títulos: no hay nada que importar.");
  if (filas.length > FILAS_MAXIMAS) {
    throw new Error(`El archivo trae ${filas.length} filas y el máximo es ${FILAS_MAXIMAS}. Divídelo en varios.`);
  }
  return { cabeceras: cabeceras.map((c) => c.trim()), filas };
}

/** Normaliza un título de columna para compararlo: sin acentos, sin signos, en minúscula.
 *  Así «Precio de venta», «precio_de_venta» y «PRECIO DE VENTA» son la misma cosa. */
export function normalizar(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
