import type { SupabaseClient } from "@supabase/supabase-js";
import { round2 } from "@/lib/ventas/totals";

export type StockStatus = "en_stock" | "bajo" | "agotado";
export type StockRow = { productId: string; name: string; sku: string | null; qty: number; minStock: number; status: StockStatus };

function statusOf(qty: number, minStock: number): StockStatus {
  if (qty <= 0) return "agotado";
  if (qty <= minStock) return "bajo";
  return "en_stock";
}
function sanitize(term: string): string { return term.replace(/[%,()*]/g, " ").trim(); }

export async function listStock(sb: SupabaseClient, opts: {
  search?: string; status?: "todos" | "bajo" | "agotado"; branchId?: string | null;
} = {}): Promise<StockRow[]> {
  try {
    const { search = "", status = "todos", branchId = null } = opts;
    const { data: products } = await sb.from("products")
      .select("id, name, sku, min_stock").eq("kind", "good").eq("active", true).order("name");
    let lq = sb.from("stock_levels").select("product_id, branch_id, qty");
    if (branchId) lq = lq.eq("branch_id", branchId);
    const { data: levels } = await lq;
    const byProduct = new Map<string, number>();
    for (const l of (levels ?? []) as any[]) byProduct.set(l.product_id, (byProduct.get(l.product_id) ?? 0) + Number(l.qty));

    const s = sanitize(search).toLowerCase();
    let rows: StockRow[] = (products ?? []).map((p: any) => {
      const qty = round2(byProduct.get(p.id) ?? 0);
      const minStock = Number(p.min_stock);
      return { productId: p.id, name: p.name, sku: p.sku, qty, minStock, status: statusOf(qty, minStock) };
    });
    if (s) rows = rows.filter((r) => r.name.toLowerCase().includes(s) || (r.sku ?? "").toLowerCase().includes(s));
    if (status === "bajo") rows = rows.filter((r) => r.status === "bajo");
    else if (status === "agotado") rows = rows.filter((r) => r.status === "agotado");
    return rows;
  } catch { return []; }
}

export async function getProductStock(sb: SupabaseClient, productId: string): Promise<{
  levels: { branchId: string; branchName: string | null; qty: number }[]; minStock: number;
}> {
  try {
    const { data: prod } = await sb.from("products").select("min_stock").eq("id", productId).maybeSingle();
    const { data } = await sb.from("stock_levels").select("branch_id, qty, branches(name)").eq("product_id", productId);
    const levels = (data ?? []).map((l: any) => ({ branchId: l.branch_id, branchName: l.branches?.name ?? null, qty: Number(l.qty) }));
    return { levels, minStock: prod ? Number(prod.min_stock) : 0 };
  } catch { return { levels: [], minStock: 0 }; }
}

export async function listMovements(sb: SupabaseClient, productId: string, opts: { limit?: number } = {}): Promise<{
  id: string; type: string; qtyDelta: number; branchName: string | null; reason: string | null; createdAt: string;
}[]> {
  const { data } = await sb.from("stock_movements")
    .select("id, type, qty_delta, reason, created_at, branches(name)")
    .eq("product_id", productId).order("created_at", { ascending: false }).limit(opts.limit ?? 20);
  return (data ?? []).map((m: any) => ({ id: m.id, type: m.type, qtyDelta: Number(m.qty_delta), branchName: m.branches?.name ?? null, reason: m.reason, createdAt: m.created_at }));
}

async function goodLevels(sb: SupabaseClient) {
  const { data, error } = await sb.from("stock_levels").select("qty, products(cost, min_stock, kind, active)");
  if (error || !data) return null;
  return (data as any[]).filter((l) => l.products?.kind === "good" && l.products?.active);
}

export async function stockKpi(sb: SupabaseClient): Promise<{ value: number; lowCount: number; outCount: number }> {
  try {
    const rows = await goodLevels(sb);
    if (!rows) return { value: 0, lowCount: 0, outCount: 0 };
    let value = 0, lowCount = 0, outCount = 0;
    for (const l of rows) {
      const qty = Number(l.qty), cost = Number(l.products.cost ?? 0), min = Number(l.products.min_stock);
      value += qty * cost;
      if (qty <= 0) outCount++; else if (qty <= min) lowCount++;
    }
    return { value: round2(value), lowCount, outCount };
  } catch { return { value: 0, lowCount: 0, outCount: 0 }; }
}

export async function inventoryStatusBreakdown(sb: SupabaseClient): Promise<{ inStock: number; low: number; out: number }> {
  try {
    const rows = await goodLevels(sb);
    if (!rows) return { inStock: 0, low: 0, out: 0 };
    let inStock = 0, low = 0, out = 0;
    for (const l of rows) {
      const qty = Number(l.qty), min = Number(l.products.min_stock);
      if (qty <= 0) out++; else if (qty <= min) low++; else inStock++;
    }
    return { inStock, low, out };
  } catch { return { inStock: 0, low: 0, out: 0 }; }
}

export async function inventoryValuation(sb: SupabaseClient, opts: { branchId?: string | null } = {}): Promise<{
  total: number; rows: { productId: string; name: string; branchName: string | null; qty: number; cost: number; value: number }[];
}> {
  try {
    let q = sb.from("stock_levels").select("product_id, branch_id, qty, products(name, cost, kind, active), branches(name)");
    if (opts.branchId) q = q.eq("branch_id", opts.branchId);
    const { data, error } = await q;
    if (error || !data) return { total: 0, rows: [] };
    const rows = (data as any[])
      .filter((l) => l.products?.kind === "good" && l.products?.active)
      .map((l) => {
        const qty = Number(l.qty), cost = Number(l.products.cost ?? 0);
        return { productId: l.product_id, name: l.products.name, branchName: l.branches?.name ?? null, qty, cost, value: round2(qty * cost) };
      })
      .sort((a, b) => b.value - a.value);
    return { total: round2(rows.reduce((s, r) => s + r.value, 0)), rows };
  } catch { return { total: 0, rows: [] }; }
}
