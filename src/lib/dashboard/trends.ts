import type { SupabaseClient } from "@supabase/supabase-js";
import { round2 } from "@/lib/ventas/totals";
import { monthRange, sameSpanLastMonth } from "@/lib/reportes/ranges";
import { rangeToInstants, localDateISO } from "@/lib/tz";

export type Trend = {
  /** Variación porcentual frente al mismo tramo del mes pasado. `null` = no se puede comparar. */
  pct: number | null;
  /** Valor del tramo anterior, para decir contra qué se compara. */
  previo: number;
  /** Por qué no hay porcentaje, cuando no lo hay. */
  motivo?: "sin-base" | "sin-datos";
};

const SIN_BASE: Trend = { pct: null, previo: 0, motivo: "sin-base" };

/** Variación entre dos valores. Sin base previa no hay porcentaje: decir «+100 %»
 *  cuando antes no había nada es un número bonito que no informa de nada. */
export function variacion(actual: number, previo: number): Trend {
  if (previo === 0) return { pct: null, previo, motivo: actual === 0 ? "sin-datos" : "sin-base" };
  return { pct: Math.round(((actual - previo) / previo) * 1000) / 10, previo };
}

export type DashboardTrends = { ventas: Trend; ticket: Trend };

/** Comparación del mes en curso contra el mismo tramo del mes pasado.
 *
 *  Degrada a «sin comparación» ante cualquier error: una tarjeta sin flecha es
 *  correcta; una flecha calculada sobre datos a medias, no. */
export async function dashboardTrends(sb: SupabaseClient, tz: string): Promise<DashboardTrends> {
  const vacio: DashboardTrends = { ventas: SIN_BASE, ticket: SIN_BASE };
  try {
    const hoy = localDateISO(new Date(), tz);
    const actual = rangeToInstants(monthRange(new Date(), tz), tz);
    const previo = rangeToInstants(sameSpanLastMonth(hoy), tz);

    const [ventasAct, ventasPrev] = await Promise.all([
      sb.from("sales").select("total").eq("status", "issued")
        .gte("issued_at", actual.fromInstant).lt("issued_at", actual.toInstant),
      sb.from("sales").select("total").eq("status", "issued")
        .gte("issued_at", previo.fromInstant).lt("issued_at", previo.toInstant),
    ]);
    if (ventasAct.error || ventasPrev.error) return vacio;

    const sumar = (rows: any[] | null) => round2((rows ?? []).reduce((s, r) => s + Number(r.total), 0));
    const totalAct = sumar(ventasAct.data), totalPrev = sumar(ventasPrev.data);
    const nAct = (ventasAct.data ?? []).length, nPrev = (ventasPrev.data ?? []).length;

    return {
      ventas: variacion(totalAct, totalPrev),
      ticket: variacion(nAct ? round2(totalAct / nAct) : 0, nPrev ? round2(totalPrev / nPrev) : 0),
    };
  } catch (e) {
    console.error("dashboardTrends", e);
    return vacio;
  }
}
