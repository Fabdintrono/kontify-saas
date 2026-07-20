import type { SupabaseClient } from "@supabase/supabase-js";

export type ClientListRow = {
  id: string; name: string; kind: "person" | "company";
  phone: string | null; email: string | null; active: boolean;
  typeId: string | null; typeName: string | null;
};
export type ClientStatus = "activos" | "archivados" | "todos";

// Neutraliza caracteres con significado en filtros PostgREST para evitar inyección en .or()
function sanitize(term: string): string {
  return term.replace(/[%,()*]/g, " ").trim();
}

export async function listClients(sb: SupabaseClient, opts: {
  search?: string; typeId?: string | null; status?: ClientStatus; page?: number; pageSize?: number;
} = {}): Promise<{ rows: ClientListRow[]; total: number; page: number; pageSize: number }> {
  const { search = "", typeId = null, status = "activos", page = 1, pageSize = 20 } = opts;
  let q = sb.from("clients").select("id, name, kind, phone, email, active, type_id, client_types(name)", { count: "exact" });
  if (status === "activos") q = q.eq("active", true);
  else if (status === "archivados") q = q.eq("active", false);
  if (typeId) q = q.eq("type_id", typeId);
  const s = sanitize(search);
  if (s) q = q.or(`name.ilike.%${s}%,phone.ilike.%${s}%,email.ilike.%${s}%,doc_id.ilike.%${s}%`);
  const from = (page - 1) * pageSize;
  q = q.order("name").range(from, from + pageSize - 1);
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
export async function clientsKpi(sb: SupabaseClient): Promise<{ total: number; newThisMonth: number }> {
  try {
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const total = await sb.from("clients").select("id", { count: "exact", head: true }).eq("active", true);
    const fresh = await sb.from("clients").select("id", { count: "exact", head: true })
      .eq("active", true).gte("created_at", monthStart.toISOString());
    if (total.error || fresh.error) return { total: 0, newThisMonth: 0 };
    return { total: total.count ?? 0, newThisMonth: fresh.count ?? 0 };
  } catch { return { total: 0, newThisMonth: 0 }; }
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
