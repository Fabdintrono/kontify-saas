import type { SupabaseClient } from "@supabase/supabase-js";

export type TenantSettings = { currency: string; timezone: string };
export const DEFAULT_TZ = "America/Caracas";
export const DEFAULT_CURRENCY = "USD";

function validTz(tz: unknown): tz is string {
  if (typeof tz !== "string" || !tz) return false;
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return true; } catch { return false; }
}

/** Moneda y zona horaria de la empresa del usuario. Nunca lanza: ante error devuelve defaults. */
export async function getTenantSettings(sb: SupabaseClient): Promise<TenantSettings> {
  const defaults: TenantSettings = { currency: DEFAULT_CURRENCY, timezone: DEFAULT_TZ };
  try {
    const { data, error } = await sb.from("tenants").select("currency, timezone").maybeSingle();
    if (!error && data) {
      return {
        currency: (data.currency as string) || DEFAULT_CURRENCY,
        timezone: validTz(data.timezone) ? data.timezone : DEFAULT_TZ,
      };
    }
    // Si falló (p. ej. la columna timezone aún no existe), al menos la moneda debe ser la real.
    const { data: c } = await sb.from("tenants").select("currency").maybeSingle();
    return { currency: (c?.currency as string) || DEFAULT_CURRENCY, timezone: DEFAULT_TZ };
  } catch { return defaults; }
}
