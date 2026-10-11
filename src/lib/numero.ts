/** Lectura de un número tal como lo escribe la gente aquí.
 *
 *  Un `<input type="number">` solo acepta el separador decimal de la configuración del
 *  navegador, así que quien escribe «65,50» ve cómo el campo se le queda vacío. Los
 *  campos de monto son de texto y el valor pasa por aquí, tanto al enviar el formulario
 *  como al leer un Excel.
 */
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
