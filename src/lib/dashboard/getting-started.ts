import type { SupabaseClient } from "@supabase/supabase-js";

export type GettingStartedItem = { key: "producto" | "existencias" | "cliente" | "venta" | "equipo"; label: string; href: string; done: boolean };
export type GettingStartedStatus = { items: GettingStartedItem[]; done: number; total: number; hidden: boolean };

const EMPTY: GettingStartedStatus = { items: [], done: 0, total: 5, hidden: true };

/** Progreso de «Primeros pasos» calculado con datos reales (no se guarda estado por tarea). Degrada a oculto ante error. */
export async function gettingStartedStatus(sb: SupabaseClient): Promise<GettingStartedStatus> {
  try {
    const [tenant, products, levels, clients, sales, members] = await Promise.all([
      sb.from("tenants").select("getting_started_hidden").maybeSingle(),
      sb.from("products").select("id", { count: "exact", head: true }).eq("active", true),
      sb.from("stock_levels").select("product_id", { count: "exact", head: true }).gt("qty", 0),
      sb.from("clients").select("id", { count: "exact", head: true }).eq("active", true),
      sb.from("sales").select("id", { count: "exact", head: true }).eq("status", "issued"),
      sb.from("memberships").select("user_id", { count: "exact", head: true }),
    ]);
    if (tenant.error || products.error || levels.error || clients.error || sales.error || members.error) return EMPTY;
    const items: GettingStartedItem[] = [
      { key: "producto", label: "Crea tu primer producto", href: "/operaciones/productos/nuevo", done: (products.count ?? 0) > 0 },
      { key: "existencias", label: "Carga existencias en Inventario", href: "/operaciones/inventario", done: (levels.count ?? 0) > 0 },
      { key: "cliente", label: "Registra un cliente", href: "/clientes/nuevo", done: (clients.count ?? 0) > 0 },
      { key: "venta", label: "Haz tu primera venta", href: "/operaciones/facturacion/nueva", done: (sales.count ?? 0) > 0 },
      { key: "equipo", label: "Invita a tu equipo", href: "/configuracion/usuarios", done: (members.count ?? 0) > 1 },
    ];
    return { items, done: items.filter((i) => i.done).length, total: items.length, hidden: !!tenant.data?.getting_started_hidden };
  } catch (e) { console.error("gettingStartedStatus", e); return EMPTY; }
}
