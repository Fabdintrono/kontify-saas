import { inflateRawSync } from "node:zlib";

/** Lector de `.xlsx` sin dependencias.
 *
 *  Un xlsx es un ZIP con XML dentro. Solo hace falta leer tres piezas: qué hoja es la
 *  primera, la tabla de textos compartidos y las celdas de esa hoja. No se interpretan
 *  estilos ni fechas: lo que importan los usuarios aquí son textos y números.
 *
 *  Se escribió a mano en vez de traer una librería porque las dos candidatas de npm
 *  pesan 21 MB o arrastran vulnerabilidades sin parchear, y lo que se necesita es
 *  una fracción de lo que hacen. */

type Entrada = { nombre: string; datos: Buffer };

const FIRMA_CENTRAL = 0x02014b50;
const FIRMA_FIN = 0x06054b50;

/** Lee el directorio central del ZIP y descomprime solo las entradas que se piden. */
function leerZip(buf: Buffer, queremos: (nombre: string) => boolean): Entrada[] {
  const fin = buscarFinCentral(buf);
  if (fin < 0) throw new Error("El archivo no parece un .xlsx válido.");
  const total = buf.readUInt16LE(fin + 10);
  let p = buf.readUInt32LE(fin + 16);

  const salida: Entrada[] = [];
  for (let i = 0; i < total; i++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== FIRMA_CENTRAL) break;
    const metodo = buf.readUInt16LE(p + 10);
    const comprimido = buf.readUInt32LE(p + 20);
    const nLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const comentLen = buf.readUInt16LE(p + 32);
    const desplazamiento = buf.readUInt32LE(p + 42);
    const nombre = buf.toString("utf8", p + 46, p + 46 + nLen);
    p += 46 + nLen + extraLen + comentLen;

    if (!queremos(nombre)) continue;

    // Cabecera local: sus longitudes de nombre y extra pueden no coincidir con las del central.
    const lnLen = buf.readUInt16LE(desplazamiento + 26);
    const lExtraLen = buf.readUInt16LE(desplazamiento + 28);
    const inicio = desplazamiento + 30 + lnLen + lExtraLen;
    const crudo = buf.subarray(inicio, inicio + comprimido);
    salida.push({ nombre, datos: metodo === 0 ? crudo : inflateRawSync(crudo) });
  }
  return salida;
}

/** El fin del directorio central va al final, pero puede llevar comentario detrás. */
function buscarFinCentral(buf: Buffer): number {
  const minimo = Math.max(0, buf.length - 22 - 0xffff);
  for (let i = buf.length - 22; i >= minimo; i--) {
    if (buf.readUInt32LE(i) === FIRMA_FIN) return i;
  }
  return -1;
}

const ENTIDADES: Record<string, string> = {
  "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'",
};

function desescapar(s: string): string {
  return s.replace(/&(amp|lt|gt|quot|apos);/g, (m) => ENTIDADES[m])
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

/** Todo el texto de un `<si>`: los textos con formato vienen partidos en varios `<t>`. */
function textosCompartidos(xml: string): string[] {
  const out: string[] = [];
  for (const si of xml.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
    let t = "";
    for (const m of si[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)) t += m[1];
    out.push(desescapar(t));
  }
  return out;
}

/** "AB12" → 27 (índice de columna, base 0). */
export function columnaDeRef(ref: string): number {
  const letras = ref.match(/^[A-Z]+/i)?.[0] ?? "A";
  let n = 0;
  for (const c of letras.toUpperCase()) n = n * 26 + (c.charCodeAt(0) - 64);
  return n - 1;
}

function celdas(xml: string, compartidos: string[]): string[][] {
  const filas: string[][] = [];
  // `<row r="5"/>`: Excel autocierra las filas vacías. Sin contemplarlo, la apertura
  // de una fila vacía se emparejaba con el cierre de la siguiente y se perdía una fila.
  for (const fila of xml.matchAll(/<row[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const valores: string[] = [];
    for (const c of (fila[1] ?? "").matchAll(/<c([^>]*)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = c[1], cuerpo = c[2] ?? "";
      const tipo = attrs.match(/\bt="([^"]+)"/)?.[1];
      const ref = attrs.match(/\br="([A-Z]+\d+)"/i)?.[1];
      const col = ref ? columnaDeRef(ref) : valores.length;

      let valor = "";
      if (tipo === "inlineStr") {
        for (const t of cuerpo.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)) valor += t[1];
        valor = desescapar(valor);
      } else {
        const v = cuerpo.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? "";
        valor = tipo === "s" ? (compartidos[Number(v)] ?? "") : desescapar(v);
      }
      // Las celdas que el archivo se salta quedan vacías, no desplazan a las demás.
      while (valores.length < col) valores.push("");
      valores[col] = valor;
    }
    filas.push(valores);
  }
  return filas.filter((f) => f.some((v) => v.trim() !== ""));
}

/** Primera hoja del libro, como matriz de celdas de texto. */
export function parseXlsx(buf: Buffer): string[][] {
  const quiero = (n: string) =>
    n === "xl/workbook.xml" || n === "xl/sharedStrings.xml" ||
    n === "xl/_rels/workbook.xml.rels" || n.startsWith("xl/worksheets/");
  const entradas = leerZip(buf, quiero);
  const texto = (n: string) => entradas.find((e) => e.nombre === n)?.datos.toString("utf8");

  const compartidos = textosCompartidos(texto("xl/sharedStrings.xml") ?? "");

  // Qué hoja es la primera: el libro la nombra por relación, y la relación da la ruta.
  const libro = texto("xl/workbook.xml") ?? "";
  const rels = texto("xl/_rels/workbook.xml.rels") ?? "";
  const rid = libro.match(/<sheet[^>]*r:id="([^"]+)"/)?.[1];
  const destino = rid
    ? rels.match(new RegExp(`Id="${rid}"[^>]*Target="([^"]+)"`))?.[1]
    : undefined;
  const ruta = destino
    ? "xl/" + destino.replace(/^\/?xl\//, "").replace(/^\//, "")
    : undefined;

  const hoja = (ruta && texto(ruta))
    ?? entradas.filter((e) => e.nombre.startsWith("xl/worksheets/") && e.nombre.endsWith(".xml"))
      .sort((a, b) => a.nombre.localeCompare(b.nombre))[0]?.datos.toString("utf8");

  if (!hoja) throw new Error("El archivo no trae ninguna hoja que se pueda leer.");
  return celdas(hoja, compartidos);
}
