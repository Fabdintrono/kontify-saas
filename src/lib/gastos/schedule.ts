import { addDaysISO, assertDateISO } from "@/lib/tz";
import type { Frecuencia } from "./schema";

const MESES: Partial<Record<Frecuencia, number>> = {
  mensual: 1, bimestral: 2, trimestral: 3, anual: 12,
};

/** Último día del mes (1-12) de un año. */
function ultimoDia(anio: number, mes: number): number {
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate();
}

const iso = (a: number, m: number, d: number) =>
  `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** Cuándo toca el siguiente pago de un gasto fijo.
 *
 *  `anclaDia` es el día del mes que eligió el usuario. Hace falta guardarlo aparte
 *  porque si no, el 31 de enero se recorta al 28 de febrero y a partir de ahí el gasto
 *  se queda pegado al 28 para siempre. Con el ancla, febrero recorta pero marzo vuelve
 *  al 31, que es lo que espera quien paga un alquiler. */
export function siguienteFecha(desdeISO: string, frecuencia: Frecuencia, anclaDia?: number): string {
  assertDateISO(desdeISO);
  if (frecuencia === "semanal") return addDaysISO(desdeISO, 7);
  if (frecuencia === "quincenal") return addDaysISO(desdeISO, 15);

  const saltoMeses = MESES[frecuencia];
  if (!saltoMeses) return addDaysISO(desdeISO, 30);   // defensa: frecuencia desconocida

  const [a, m] = desdeISO.split("-").map(Number);
  const dia = anclaDia && anclaDia >= 1 && anclaDia <= 31 ? anclaDia : Number(desdeISO.slice(8, 10));

  const total = (m - 1) + saltoMeses;
  const anio = a + Math.floor(total / 12);
  const mes = (total % 12) + 1;
  return iso(anio, mes, Math.min(dia, ultimoDia(anio, mes)));
}

/** Cuántos días faltan para una fecha, contando desde «hoy» en la zona de la empresa.
 *  Negativo si ya pasó. */
export function diasHasta(fechaISO: string, hoyISO: string): number {
  assertDateISO(fechaISO);
  assertDateISO(hoyISO);
  // `Date.UTC` cuenta los meses desde cero: pasarle el mes tal cual desplaza las dos
  // fechas un mes y la diferencia solo cuadra por casualidad dentro del mismo mes.
  const aUTC = (d: string) => {
    const [a, m, dia] = d.split("-").map(Number);
    return Date.UTC(a, m - 1, dia);
  };
  return Math.round((aUTC(fechaISO) - aUTC(hoyISO)) / 86_400_000);
}

export type EstadoVencimiento = "vencido" | "hoy" | "proximo" | "lejano";

/** Cómo de urgente es un gasto fijo. «Próximo» son los siete días siguientes: lo que
 *  cabe en la semana y conviene tener presente al mirar la caja. */
export function estadoVencimiento(fechaISO: string, hoyISO: string): EstadoVencimiento {
  const d = diasHasta(fechaISO, hoyISO);
  if (d < 0) return "vencido";
  if (d === 0) return "hoy";
  return d <= 7 ? "proximo" : "lejano";
}

/** Texto para un humano: «venció hace 3 días», «vence hoy», «en 5 días». */
export function textoVencimiento(fechaISO: string, hoyISO: string): string {
  const d = diasHasta(fechaISO, hoyISO);
  if (d === 0) return "vence hoy";
  if (d === 1) return "vence mañana";
  if (d === -1) return "venció ayer";
  if (d < 0) return `venció hace ${-d} días`;
  return `en ${d} días`;
}
