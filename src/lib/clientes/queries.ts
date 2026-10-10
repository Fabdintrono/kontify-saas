import type { SupabaseClient } from "@supabase/supabase-js";
import { monthRange } from "@/lib/reportes/ranges";
import { startOfDayUTC } from "@/lib/tz";
import { resolveSort, type SortSpec } from "@/lib/sorting";

export type ClientListRow = {
  id: string; name: string; kind: "person" | "company";
  phone: string | null; email: string | null; active: boolean;
  typeId: string | null; typeName: string | null;
};
export type ClientStatus = "activos" | "archivados" | "todos";

/** Columnas por las que puede ordenar la lista de clientes. Lo que no esté aquí
 *  cae al orden por defecto: nada escrito por el usuario llega a `.order()`. */
export const CLIENTS_SORT: SortSpec = {
  default: { key: "name", dir: "asc" },
  columns: {
    name: { column: "name", natural: "asc" },
    type: { column: "client_types(name)", natural: "asc", nullsFirst: false },
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
  let q = sb.from("clients").select("id, name, kind, phone, email, active, type_id, client_types(name)", { count: "exact" });
  if (status === "activos") q = q.eq("active", true);
  else if (status === "archivados") q = q.eq("active", false);
  if (typeId) q = q.eq("type_id", typeId);
  const s = sanitize(search);
  if (s) q = q.or(`name.ilike.%${s}%,phone.ilike.%${s}%,email.ilike.%${s}%,doc_id.ilike.%${s}%`);
  const from = (page - 1) * pageSize;
  q = q.order(order.column, { ascending: order.ascending, nullsFirst: order.nullsFirst ?? order.ascending });
  // Segundo criterio estable: sin él, dos filas con el mismo valor pueden saltar de página.
  if (order.column !== "name") q = q.order("name", { ascending: true });
  q = q.range(from, from + pageSize - 1);
  const { data, error, count } = await q;
  if (error) throw error;
  const rows: ClientListRow[] = (data ?? []).map((r: any) => ({
    id: r.id, name: r.name, kind: r.kind, phone: r.phone, email: r.email, active: r.active,
    typeId: r.type_id, typeName: r.client_types?.name ?? null,
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
