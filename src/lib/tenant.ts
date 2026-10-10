import type { SupabaseClient } from "@supabase/supabase-js";

export type TenantSettings = { currency: string; timezone: string };
export const DEFAULT_TZ = "America/Caracas";

function validTz(tz: unknown): tz is string {
  if (typeof tz !== "string" || !tz) return false;
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return true; } catch { return false; }
}

/** Moneda y zona horaria de la empresa del usuario. Nunca lanza: ante error devuelve defaults. */
export async function getTenantSettings(sb: SupabaseClient): Promise<TenantSettings> {
  try {
    const { data, error } = await sb.from("tenants").select("currency, timezone").maybeSingle();
    if (error || !data) return { currency: "USD", timezone: DEFAULT_TZ };
    return {
      currency: (data.currency as string) || "USD",
      timezone: validTz(data.timezone) ? data.timezone : DEFAULT_TZ,
    };
  } catch { return { currency: "USD", timezone: DEFAULT_TZ }; }
}
