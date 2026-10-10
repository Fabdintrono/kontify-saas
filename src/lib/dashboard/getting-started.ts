import type { SupabaseClient } from "@supabase/supabase-js";
import type { Role } from "@/lib/auth/roles";

/** `available: false` = la pantalla aún no existe: el paso se muestra como «pronto», sin enlace,
 *  y no cuenta para el 100 % (si contara, la tarjeta nunca se podría ocultar). */
export type GettingStartedItem = { key: "producto" | "existencias" | "cliente" | "venta" | "equipo"; label: string; href: string; done: boolean; available: boolean };
/** `done`/`total` cuentan los cinco pasos (el «4 de 5» que ve el usuario); `complete` solo los disponibles. */
export type GettingStartedStatus = { items: GettingStartedItem[]; done: number; total: number; complete: boolean; hidden: boolean };

const EMPTY: GettingStartedStatus = { items: [], done: 0, total: 5, complete: false, hidden: true };

/** La tarjeta de «Primeros pasos» es para quien configura la empresa. */
export const canSeeGettingStarted = (r: Role) => r === "owner" || r === "admin";
/** Ocultarla afecta a toda la empresa: mismo permiso que verla. */
export const canHideGettingStarted = canSeeGettingStarted;

/** Progreso de «Primeros pasos» calculado con datos reales (no se guarda estado por tarea). Degrada a oculto ante error. */
export async function gettingStartedStatus(sb: SupabaseClient): Promise<GettingStartedStatus> {
  try {
    const [tenant, products, levels, clients, sales, members] = await Promise.all([
      sb.from("tenants").select("getting_started_hidden").maybeSingle(),
      sb.from("products").select("id", { count: "exact", head: true }).eq("active", true),
      // Conteo con RLS del usuario: un rol de sucursal ve solo su sede (por diseño).
      sb.from("stock_levels").select("product_id", { count: "exact", head: true }).gt("qty", 0),
      sb.from("clients").select("id", { count: "exact", head: true }).eq("active", true),
      sb.from("sales").select("id", { count: "exact", head: true }).eq("status", "issued"),
      sb.from("memberships").select("user_id", { count: "exact", head: true }),
    ]);
    if (tenant.error || products.error || levels.error || clients.error || sales.error || members.error) return EMPTY;
    const items: GettingStartedItem[] = [
      { key: "producto", label: "Crea tu primer producto", href: "/operaciones/productos/nuevo", done: (products.count ?? 0) > 0, available: true },
      { key: "existencias", label: "Carga existencias en Inventario", href: "/operaciones/inventario", done: (levels.count ?? 0) > 0, available: true },
      { key: "cliente", label: "Registra un cliente", href: "/clientes/nuevo", done: (clients.count ?? 0) > 0, available: true },
      { key: "venta", label: "Haz tu primera venta", href: "/operaciones/facturacion/nueva", done: (sales.count ?? 0) > 0, available: true },
      { key: "equipo", label: "Invita a tu equipo (pronto)", href: "/configuracion/usuarios", done: (members.count ?? 0) > 1, available: false },
    ];
    return {
      items,
      done: items.filter((i) => i.done).length,
      total: items.length,
      complete: items.every((i) => !i.available || i.done),
      hidden: !!tenant.data?.getting_started_hidden,
    };
  } catch (e) { console.error("gettingStartedStatus", e); return EMPTY; }
}
