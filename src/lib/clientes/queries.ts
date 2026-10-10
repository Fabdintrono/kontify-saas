import type { SupabaseClient } from "@supabase/supabase-js";
import { monthRange } from "@/lib/reportes/ranges";
import { startOfDayUTC } from "@/lib/tz";
import { resolveSort, type SortSpec } from "@/lib/sorting";

export type ClientListRow = {
  id: string; name: string; kind: "person" | "company";
  phone: string | null; email: string | null; active: boolean;
  typeId: string | null; typeName: string | null;
  /** Ventas emitidas de este cliente. Los borradores no cuentan y las anuladas dejan de contar. */
  orders: number;
  /** Suma de esas ventas, en la moneda de la empresa. */
  spent: number;
  /** Instante de la última venta emitida, o null si nunca compró. */
  lastOrderAt: string | null;
};
export type ClientStatus = "activos" | "archivados" | "todos";

/** Columnas por las que puede ordenar la lista de clientes. Lo que no esté aquí
 *  cae al orden por defecto: nada escrito por el usuario llega a `.order()`. */
export const CLIENTS_SORT: SortSpec = {
  default: { key: "name", dir: "asc" },
  columns: {
    name: { column: "name", natural: "asc" },
    type: { column: "type_name", natural: "asc", nullsFirst: false },
    orders: { column: "orders_count", natural: "desc" },
    spent: { column: "spent_total", natural: "desc" },
    lastOrder: { column: "last_order_at", natural: "desc", nullsFirst: false },
    status: { column: "active", natural: "desc" },
  },
};

// Neutraliza caracteres con significado en filtros PostgREST para evitar inyección en .or()
function sanitize(term: string): string {
  return term.replace(/[%,()*]/g, " ").trim();
}

export async function listClients(sb: SupabaseClient, opts: {
  search?: string; typeId?: string | null; status?: ClientStatus; page?: number; pageSize?: number;
  sort?: string; dir?: string;
} = {}): Promise<{ rows: ClientListRow[]; total: number; page: number; pageSize: number }> {
  const { search = "", typeId = null, status = "activos", page = 1, pageSize = 20 } = opts;
  const order = resolveSort(CLIENTS_SORT, opts.sort, opts.dir);
  // `clients_with_stats` es la misma tabla más tres columnas agregadas de ventas.
  // Leer de la vista es lo que permite ordenar por «cuánto me compra» sobre el total,
  // y no solo dentro de la página que se está viendo.
  let q = sb.from("clients_with_stats")
    .select("id, name, kind, phone, email, active, type_id, type_name, orders_count, spent_total, last_order_at",
      { count: "exact" });
  if (status === "activos") q = q.eq("active", true);
  else if (status === "archivados") q = q.eq("active", false);
  if (typeId) q = q.eq("type_id", typeId);
  const s = sanitize(search);
  if (s) q = q.or(`name.ilike.%${s}%,phone.ilike.%${s}%,email.ilike.%${s}%,doc_id.ilike.%${s}%`);
  const from = (page - 1) * pageSize;
  // Los vacíos van siempre al final, ordene hacia donde ordene: igual que `compareBy`
  // en las listas que ordenan en memoria. Postgres, por su cuenta, los pondría primero al bajar.
  q = q.order(order.column, { ascending: order.ascending, nullsFirst: order.nullsFirst ?? false });
  // Segundo criterio estable: sin él, dos filas con el mismo valor pueden saltar de página.
  if (order.column !== "name") q = q.order("name", { ascending: true });
  q = q.range(from, from + pageSize - 1);
  const { data, error, count } = await q;
  if (error) throw error;
  const rows: ClientListRow[] = (data ?? []).map((r: any) => ({
    id: r.id, name: r.name, kind: r.kind, phone: r.phone, email: r.email, active: r.active,
    typeId: r.type_id, typeName: r.type_name ?? null,
    orders: Number(r.orders_count ?? 0), spent: Number(r.spent_total ?? 0),
    lastOrderAt: r.last_order_at ?? null,
  }));
  return { rows, total: count ?? 0, page, pageSize };
}

export async function getClient(sb: SupabaseClient, id: string) {
  const { data, error } = await sb.from("clients").select("*, client_types(name)").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as any;
}

export async function listClientTypes(sb: SupabaseClient, opts: { includeInactive?: boolean } = {}) {
  let q = sb.from("client_types").select("id, name, active").order("name");
  if (!opts.includeInactive) q = q.eq("active", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as { id: string; name: string; active: boolean }[];
}

// Consumidas por el dashboard, que también ven roles SIN acceso a Clientes (cajero/almacén):
// ante error/permiso denegado devuelven vacío, nunca lanzan, para no crashear el dashboard.
export async function clientsKpi(sb: SupabaseClient, tz: string): Promise<{ total: number; newThisMonth: number }> {
  try {
    const fromInstant = startOfDayUTC(monthRange(new Date(), tz).from, tz);
    const total = await sb.from("clients").select("id", { count: "exact", head: true }).eq("active", true);
    const fresh = await sb.from("clients").select("id", { count: "exact", head: true })
      .eq("active", true).gte("created_at", fromInstant);
    if (total.error || fresh.error) return { total: 0, newThisMonth: 0 };
    return { total: total.count ?? 0, newThisMonth: fresh.count ?? 0 };
  } catch (e) { console.error("clientsKpi", e); return { total: 0, newThisMonth: 0 }; }
}

export async function clientsByType(sb: SupabaseClient): Promise<{ typeId: string | null; name: string; count: number }[]> {
  try {
    const { data, error } = await sb.from("clients").select("type_id, client_types(name)").eq("active", true);
    if (error || !data) return [];
    const map = new Map<string, { typeId: string | null; name: string; count: number }>();
    for (const r of data as any[]) {
      const key = r.type_id ?? "none";
      const cur = map.get(key) ?? { typeId: r.type_id ?? null, name: r.client_types?.name ?? "Sin tipo", count: 0 };
      cur.count++; map.set(key, cur);
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
  } catch { return []; }
}

/** Resumen de la cartera para las tarjetas de la lista.
 *  Degrada a ceros ante cualquier error: una tarjeta en cero es correcta, una cifra
 *  calculada sobre una consulta fallida, no. */
export async function clientsOverview(sb: SupabaseClient, tz: string): Promise<{
  activos: number; archivados: number; nuevosEsteMes: number;
}> {
  const cero = { activos: 0, archivados: 0, nuevosEsteMes: 0 };
  try {
    const desde = startOfDayUTC(monthRange(new Date(), tz).from, tz);
    const [act, arch, nuevos] = await Promise.all([
      sb.from("clients").select("id", { count: "exact", head: true }).eq("active", true),
      sb.from("clients").select("id", { count: "exact", head: true }).eq("active", false),
      sb.from("clients").select("id", { count: "exact", head: true }).gte("created_at", desde),
    ]);
    if (act.error || arch.error || nuevos.error) return cero;
    return { activos: act.count ?? 0, archivados: arch.count ?? 0, nuevosEsteMes: nuevos.count ?? 0 };
  } catch (e) { console.error("clientsOverview", e); return cero; }
}
