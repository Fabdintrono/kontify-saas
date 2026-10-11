import { normalizar } from "./sheet";

export type TipoColumna = "texto" | "numero" | "opcion";

export type Columna = {
  key: string;
  /** Cómo se llama en la plantilla. */
  label: string;
  obligatoria: boolean;
  tipo: TipoColumna;
  /** Otros nombres que la gente usa, para reconocer la columna sin obligar a renombrar. */
  alias: string[];
  /** Valores admitidos cuando `tipo === "opcion"`, con sus sinónimos. */
  opciones?: Record<string, string[]>;
  maximo?: number;
  ejemplo: string;
  ayuda?: string;
};

/** Qué columna del archivo corresponde a cada campo, o -1 si no vino. */
export type Mapeo = Record<string, number>;

/** Empareja las columnas del archivo con los campos, por nombre o por alias.
 *  Lo que no reconoce queda en -1 y se puede ajustar a mano en la pantalla. */
export function mapear(cabeceras: string[], columnas: Columna[]): Mapeo {
  const normalizadas = cabeceras.map(normalizar);
  const mapeo: Mapeo = {};
  const usadas = new Set<number>();
  for (const c of columnas) {
    const candidatos = [c.label, ...c.alias].map(normalizar);
    const i = normalizadas.findIndex((h, idx) => !usadas.has(idx) && candidatos.includes(h));
    mapeo[c.key] = i;
    if (i >= 0) usadas.add(i);
  }
  return mapeo;
}

/** Número escrito como lo escribe la gente: «1.234,56», «1,234.56», «2,5», « 8 ».
 *
 *  La regla: si hay coma y punto, el último que aparece es el decimal y el otro
 *  separa miles. Si solo hay uno y deja exactamente tres cifras detrás, es de miles
 *  («1.500» son mil quinientos, no uno coma cinco). */
export function parseNumero(bruto: string): number | null {
  const s = bruto.trim().replace(/\s/g, "").replace(/^[$€]|[$€]$/g, "");
  if (s === "") return null;
  if (!/^-?[\d.,]+$/.test(s)) return null;

  const ultimaComa = s.lastIndexOf(",");
  const ultimoPunto = s.lastIndexOf(".");
  let limpio: string;

  if (ultimaComa >= 0 && ultimoPunto >= 0) {
    const decimal = ultimaComa > ultimoPunto ? "," : ".";
    const miles = decimal === "," ? "." : ",";
    limpio = s.split(miles).join("").replace(decimal, ".");
  } else if (ultimaComa >= 0 || ultimoPunto >= 0) {
    const sep = ultimaComa >= 0 ? "," : ".";
    const partes = s.split(sep);
    const decimales = partes[partes.length - 1].length;
    limpio = partes.length > 2 || decimales === 3
      ? partes.join("")                        // separador de miles
      : partes.join(".");                      // separador decimal
  } else {
    limpio = s;
  }

  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
}

/** A qué opción corresponde un valor escrito por el usuario, o null si a ninguna. */
export function parseOpcion(bruto: string, opciones: Record<string, string[]>): string | null {
  const v = normalizar(bruto);
  if (v === "") return null;
  for (const [clave, sinonimos] of Object.entries(opciones)) {
    if (normalizar(clave) === v || sinonimos.some((s) => normalizar(s) === v)) return clave;
  }
  return null;
}

export type ErrorCelda = { columna: string; mensaje: string };

/** Valida una fila contra las columnas. Devuelve el registro limpio y lo que falló. */
export function validarFila(
  fila: string[], columnas: Columna[], mapeo: Mapeo,
): { valores: Record<string, string | number | null>; errores: ErrorCelda[] } {
  const valores: Record<string, string | number | null> = {};
  const errores: ErrorCelda[] = [];

  for (const c of columnas) {
    const i = mapeo[c.key];
    const bruto = (i >= 0 ? fila[i] ?? "" : "").trim();

    if (bruto === "") {
      if (c.obligatoria) errores.push({ columna: c.key, mensaje: `Falta ${c.label.toLowerCase()}` });
      valores[c.key] = null;
      continue;
    }

    if (c.tipo === "numero") {
      const n = parseNumero(bruto);
      if (n === null) { errores.push({ columna: c.key, mensaje: `«${bruto}» no es un número` }); valores[c.key] = null; continue; }
      if (n < 0) { errores.push({ columna: c.key, mensaje: "No puede ser negativo" }); valores[c.key] = null; continue; }
      valores[c.key] = n;
      continue;
    }

    if (c.tipo === "opcion") {
      const v = parseOpcion(bruto, c.opciones ?? {});
      if (v === null) {
        const admitidos = Object.keys(c.opciones ?? {}).join(" o ");
        errores.push({ columna: c.key, mensaje: `«${bruto}» no vale. Usa ${admitidos}` });
        valores[c.key] = null;
        continue;
      }
      valores[c.key] = v;
      continue;
    }

    if (c.maximo && bruto.length > c.maximo) {
      errores.push({ columna: c.key, mensaje: `Son ${bruto.length} caracteres y caben ${c.maximo}` });
      valores[c.key] = bruto.slice(0, c.maximo);
      continue;
    }
    valores[c.key] = bruto;
  }

  return { valores, errores };
}

/** Contenido de la plantilla en CSV: títulos y una fila de ejemplo.
 *  Lleva BOM para que Excel abra los acentos bien al hacer doble clic. */
export function plantillaCsv(columnas: Columna[]): string {
  const escapar = (v: string) => /[",;\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  const titulos = columnas.map((c) => escapar(c.obligatoria ? `${c.label} *` : c.label)).join(",");
  const ejemplo = columnas.map((c) => escapar(c.ejemplo)).join(",");
  return "﻿" + titulos + "\n" + ejemplo + "\n";
}
