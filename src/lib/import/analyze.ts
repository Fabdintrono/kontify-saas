import { normalizar } from "./sheet";
import { validarFila, type Columna, type Mapeo, type ErrorCelda } from "./columns";
import { CLAVE_DUPLICADO, HUELLA, type Entidad } from "./entities";

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

/** Nombre del registro, para los mensajes. */
const SINGULAR: Record<Entidad, string> = { productos: "producto", clientes: "cliente", gastos: "gasto" };

/** Qué hace única a una fila: la clave natural si la entidad la tiene, o la huella
 *  compuesta si no. Devuelve null cuando la fila no se puede comparar con nada
 *  (p. ej. un producto sin SKU: dos sin código son dos productos distintos). */
export function huellaDe(
  entidad: Entidad, valores: Record<string, string | number | null>,
): { k: string; columna: string; que: string } | null {
  const clave = CLAVE_DUPLICADO[entidad];
  if (clave) {
    const v = valores[clave.key];
    if (typeof v !== "string" || v.trim() === "") return null;
    return { k: normalizar(v), columna: clave.key, que: clave.label };
  }
  const campos = HUELLA[entidad];
  if (!campos) return null;
  // Con cualquier campo de la huella vacío no hay con qué comparar.
  if (campos.some((c) => valores[c] === null || valores[c] === undefined || valores[c] === "")) return null;
  return {
    k: campos.map((c) => normalizar(String(valores[c]))).join("|"),
    columna: campos[0],
    que: "gasto",
  };
}

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

  const usadas = new Set(Object.values(mapeo).filter((i) => i >= 0));
  const ignoradas = cabeceras.filter((h, i) => !usadas.has(i) && h.trim() !== "");
  const faltantes = columnas.filter((c) => c.obligatoria && mapeo[c.key] < 0).map((c) => c.label);

  const vistas = new Map<string, number>();
  const revisadas: FilaRevisada[] = filas.map((fila, i) => {
    const { valores, errores } = validarFila(fila, columnas, mapeo);
    const linea = i + 2;   // +1 por base 1, +1 por la fila de títulos

    const h = huellaDe(entidad, valores);
    if (h) {
      const antes = vistas.get(h.k);
      const esHuella = CLAVE_DUPLICADO[entidad] === null;
      if (antes !== undefined) {
        errores.push({
          columna: h.columna,
          mensaje: esHuella ? `Igual que la fila ${antes}` : `El mismo ${h.que} que la fila ${antes}`,
        });
      } else if (existentes.has(h.k)) {
        errores.push({
          columna: h.columna,
          mensaje: esHuella
            ? "Ya hay un gasto igual ese día. Cambia el concepto si de verdad son dos"
            : `Ya existe un ${SINGULAR[entidad]} con ese ${h.que}`,
        });
      } else {
        vistas.set(h.k, linea);
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

    const h = huellaDe(entidad, f.valores);
    if (h) {
      if (vistas.has(h.k) || existentes.has(h.k)) motivos.push(`${h.que} repetido`);
      else vistas.add(h.k);
    }

    if (motivos.length > 0) rechazadas.push({ linea: f.linea, motivo: motivos.join("; ") });
    else buenas.push(f);
  }
  return { buenas, rechazadas };
}
