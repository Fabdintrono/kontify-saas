import { normalizar } from "./sheet";
import { validarFila, type Columna, type Mapeo, type ErrorCelda } from "./columns";
import { CLAVE_DUPLICADO, type Entidad } from "./entities";

export type FilaRevisada = {
  /** Número de fila tal como la ve el usuario en su hoja, contando la de títulos. */
  linea: number;
  valores: Record<string, string | number | null>;
  errores: ErrorCelda[];
};

export type Revision = {
  cabeceras: string[];
  mapeo: Mapeo;
  /** Columnas del archivo que no corresponden a ningún campo. Se ignoran, pero se avisan. */
  ignoradas: string[];
  /** Campos obligatorios que el archivo no trae. Mientras haya uno, no se puede importar. */
  faltantes: string[];
  filas: FilaRevisada[];
  validas: number;
  conError: number;
};

/** Revisa la hoja entera: valida cada celda, detecta repetidos dentro del archivo y
 *  marca los que ya existen en la base. No escribe nada. */
export function revisar(opts: {
  entidad: Entidad;
  columnas: Columna[];
  cabeceras: string[];
  filas: string[][];
  mapeo: Mapeo;
  /** Claves que ya están guardadas (SKU o documento), normalizadas. */
  existentes: Set<string>;
}): Revision {
  const { entidad, columnas, cabeceras, filas, mapeo, existentes } = opts;
  const clave = CLAVE_DUPLICADO[entidad];

  const usadas = new Set(Object.values(mapeo).filter((i) => i >= 0));
  const ignoradas = cabeceras.filter((h, i) => !usadas.has(i) && h.trim() !== "");
  const faltantes = columnas.filter((c) => c.obligatoria && mapeo[c.key] < 0).map((c) => c.label);

  const vistas = new Map<string, number>();
  const revisadas: FilaRevisada[] = filas.map((fila, i) => {
    const { valores, errores } = validarFila(fila, columnas, mapeo);
    const linea = i + 2;   // +1 por base 1, +1 por la fila de títulos

    const v = valores[clave.key];
    if (typeof v === "string" && v.trim() !== "") {
      const k = normalizar(v);
      const antes = vistas.get(k);
      if (antes !== undefined) {
        errores.push({ columna: clave.key, mensaje: `El mismo ${clave.label} que la fila ${antes}` });
      } else if (existentes.has(k)) {
        errores.push({ columna: clave.key, mensaje: `Ya existe un ${entidad === "productos" ? "producto" : "cliente"} con ese ${clave.label}` });
      } else {
        vistas.set(k, linea);
      }
    }
    return { linea, valores, errores };
  });

  const conError = revisadas.filter((r) => r.errores.length > 0).length;
  return {
    cabeceras, mapeo, ignoradas, faltantes,
    filas: revisadas,
    validas: revisadas.length - conError,
    conError,
  };
}

/** Vuelve a comprobar, ya en el servidor, las filas que el navegador declaró buenas.
 *
 *  La revisión viaja al cliente para que se pueda ver y corregir, y vuelve en la
 *  confirmación. Si solo se confiara en ella, bastaría con editar la petición para
 *  colar filas sin nombre o con un SKU repetido. Esto no vuelve a leer el archivo:
 *  revalida los valores ya convertidos contra las mismas reglas. */
export function revalidar(opts: {
  entidad: Entidad;
  columnas: Columna[];
  filas: FilaRevisada[];
  existentes: Set<string>;
}): { buenas: FilaRevisada[]; rechazadas: { linea: number; motivo: string }[] } {
  const { entidad, columnas, filas, existentes } = opts;
  const clave = CLAVE_DUPLICADO[entidad];
  const buenas: FilaRevisada[] = [];
  const rechazadas: { linea: number; motivo: string }[] = [];
  const vistas = new Set<string>();

  for (const f of filas) {
    const motivos: string[] = [];

    for (const c of columnas) {
      const v = f.valores[c.key];
      if (v === null || v === undefined || v === "") {
        if (c.obligatoria) motivos.push(`falta ${c.label.toLowerCase()}`);
        continue;
      }
      if (c.tipo === "numero") {
        if (typeof v !== "number" || !Number.isFinite(v) || v < 0) motivos.push(`${c.label.toLowerCase()} no es un número válido`);
      } else if (c.tipo === "opcion") {
        if (!Object.keys(c.opciones ?? {}).includes(String(v))) motivos.push(`${c.label.toLowerCase()} no admitido`);
      } else {
        if (typeof v !== "string") motivos.push(`${c.label.toLowerCase()} no es texto`);
        else if (c.maximo && v.length > c.maximo) motivos.push(`${c.label.toLowerCase()} demasiado largo`);
      }
    }

    // Campos que el archivo nunca trae no pueden colarse por la puerta de atrás.
    const permitidas = new Set(columnas.map((c) => c.key));
    for (const k of Object.keys(f.valores)) if (!permitidas.has(k)) motivos.push(`campo desconocido «${k}»`);

    const dup = f.valores[clave.key];
    if (typeof dup === "string" && dup.trim() !== "") {
      const k = normalizar(dup);
      if (vistas.has(k) || existentes.has(k)) motivos.push(`${clave.label} repetido`);
      else vistas.add(k);
    }

    if (motivos.length > 0) rechazadas.push({ linea: f.linea, motivo: motivos.join("; ") });
    else buenas.push(f);
  }
  return { buenas, rechazadas };
}
