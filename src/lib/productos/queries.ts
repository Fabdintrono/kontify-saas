import type { SupabaseClient } from "@supabase/supabase-js";

export type ProductListRow = {
  id: string; name: string; kind: "good" | "service";
  sku: string | null; price: number; active: boolean;
  categoryId: string | null; categoryName: string | null;
};
export type ProductStatus = "activos" | "archivados" | "todos";

// Neutraliza caracteres con significado en filtros PostgREST para evitar inyección en .or()
function sanitize(term: string): string {
  return term.replace(/[%,()*]/g, " ").trim();
}

export async function listProducts(sb: SupabaseClient, opts: {
  search?: string; categoryId?: string | null; kind?: "good" | "service" | null;
  status?: ProductStatus; page?: number; pageSize?: number;
} = {}): Promise<{ rows: ProductListRow[]; total: number; page: number; pageSize: number }> {
  const { search = "", categoryId = null, kind = null, status = "activos", page = 1, pageSize = 20 } = opts;
  let q = sb.from("products").select("id, name, kind, sku, price, active, category_id, product_categories(name)", { count: "exact" });
  if (status === "activos") q = q.eq("active", true);
  else if (status === "archivados") q = q.eq("active", false);
  if (categoryId) q = q.eq("category_id", categoryId);
  if (kind) q = q.eq("kind", kind);
  const s = sanitize(search);
  if (s) q = q.or(`name.ilike.%${s}%,sku.ilike.%${s}%`);
  const from = (page - 1) * pageSize;
  q = q.order("name").range(from, from + pageSize - 1);
  const { data, error, count } = await q;
  if (error) throw error;
  const rows: ProductListRow[] = (data ?? []).map((r: any) => ({
    id: r.id, name: r.name, kind: r.kind, sku: r.sku, price: Number(r.price), active: r.active,
    categoryId: r.category_id, categoryName: r.product_categories?.name ?? null,
  }));
  return { rows, total: count ?? 0, page, pageSize };
}

export async function getProduct(sb: SupabaseClient, id: string) {
  const { data, error } = await sb.from("products")
    .select("*, product_categories(name), tax_rates(name, rate)").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as any;
}

export async function listCategories(sb: SupabaseClient, opts: { includeInactive?: boolean } = {}) {
  let q = sb.from("product_categories").select("id, name, active").order("name");
  if (!opts.includeInactive) q = q.eq("active", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as { id: string; name: string; active: boolean }[];
}

export async function listTaxRates(sb: SupabaseClient, opts: { includeInactive?: boolean } = {}) {
  let q = sb.from("tax_rates").select("id, name, rate, is_default, active").order("name");
  if (!opts.includeInactive) q = q.eq("active", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id, name: r.name, rate: Number(r.rate), isDefault: r.is_default, active: r.active,
  })) as { id: string; name: string; rate: number; isDefault: boolean; active: boolean }[];
}

export async function getTenantCurrency(sb: SupabaseClient): Promise<string> {
  try {
    const { data, error } = await sb.from("tenants").select("currency").maybeSingle();
    if (error || !data) return "USD";
    return (data.currency as string) || "USD";
  } catch { return "USD"; }
}

// Consumidas por el dashboard: ante error/permiso denegado devuelven vacío, nunca lanzan.
export async function productsKpi(sb: SupabaseClient): Promise<{ total: number }> {
  try {
    const total = await sb.from("products").select("id", { count: "exact", head: true }).eq("active", true);
    if (total.error) return { total: 0 };
    return { total: total.count ?? 0 };
  } catch { return { total: 0 }; }
}

export async function productsByCategory(sb: SupabaseClient): Promise<{ categoryId: string | null; name: string; count: number }[]> {
  try {
    const { data, error } = await sb.from("products").select("category_id, product_categories(name)").eq("active", true);
    if (error || !data) return [];
    const map = new Map<string, { categoryId: string | null; name: string; count: number }>();
    for (const r of data as any[]) {
      const key = r.category_id ?? "none";
      const cur = map.get(key) ?? { categoryId: r.category_id ?? null, name: r.product_categories?.name ?? "Sin categoría", count: 0 };
      cur.count++; map.set(key, cur);
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
  } catch { return []; }
}
