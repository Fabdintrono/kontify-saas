import type { SupabaseClient } from "@supabase/supabase-js";
import { round2 } from "@/lib/ventas/totals";
import { addDays, monthRange, weekRange, type DateRange } from "@/lib/reportes/ranges";

export type SalesReport = {
  summary: { count: number; revenue: number; utility: number; avgTicket: number; marginPct: number; costIncompleteCount: number };
  byDay: { date: string; revenue: number; utility: number }[];
  byProduct: { productId: string | null; name: string; qty: number; revenue: number }[];
  bySeller: { userId: string | null; name: string; count: number; revenue: number; utility: number }[];
  byClient: { clientId: string | null; name: string; count: number; revenue: number }[];
};

const EMPTY: SalesReport = {
  summary: { count: 0, revenue: 0, utility: 0, avgTicket: 0, marginPct: 0, costIncompleteCount: 0 },
  byDay: [], byProduct: [], bySeller: [], byClient: [],
};

export async function salesReport(sb: SupabaseClient, opts: { from: string; to: string; branchId?: string | null }): Promise<SalesReport> {
  try {
    const { from, to, branchId = null } = opts;
    let sq = sb.from("sales").select("id, created_by, client_id, total, tax_total, issued_at, clients(name)")
      .eq("status", "issued").gte("issued_at", from).lt("issued_at", addDays(to, 1));
    if (branchId) sq = sq.eq("branch_id", branchId);
    const { data: sales, error } = await sq;
    if (error || !sales || sales.length === 0) return EMPTY;

    const saleIds = sales.map((s: any) => s.id);
    const { data: items } = await sb.from("sale_items")
      .select("sale_id, product_id, description, quantity, unit_price, discount_pct, unit_cost").in("sale_id", saleIds);
    const creators = [...new Set(sales.map((s: any) => s.created_by).filter(Boolean))] as string[];
    const { data: profs } = creators.length
      ? await sb.from("profiles").select("id, full_name").in("id", creators)
      : { data: [] as any[] };
    const nameById = new Map((profs ?? []).map((p: any) => [p.id, p.full_name]));

    // costo por venta + completitud
    const costBySale = new Map<string, number>();
    const incompleteSale = new Set<string>();
    for (const it of items ?? []) {
      const prev = costBySale.get(it.sale_id) ?? 0;
      if (it.unit_cost == null) incompleteSale.add(it.sale_id);
      costBySale.set(it.sale_id, prev + (it.unit_cost != null ? Number(it.unit_cost) * Number(it.quantity) : 0));
    }

    let count = 0, revenue = 0, netRevenue = 0, utility = 0, costIncompleteCount = 0;
    const byDay = new Map<string, { date: string; revenue: number; utility: number }>();
    const bySeller = new Map<string, { userId: string | null; name: string; count: number; revenue: number; utility: number }>();
    const byClient = new Map<string, { clientId: string | null; name: string; count: number; revenue: number }>();

    for (const s of sales as any[]) {
      count++;
      const total = Number(s.total), net = total - Number(s.tax_total);
      const util = net - (costBySale.get(s.id) ?? 0);
      revenue += total; netRevenue += net; utility += util;
      if (incompleteSale.has(s.id)) costIncompleteCount++;
      const date = String(s.issued_at).slice(0, 10);
      const d = byDay.get(date) ?? { date, revenue: 0, utility: 0 }; d.revenue += total; d.utility += util; byDay.set(date, d);
      const sk = s.created_by ?? "none";
      const se = bySeller.get(sk) ?? { userId: s.created_by ?? null, name: nameById.get(s.created_by) || "—", count: 0, revenue: 0, utility: 0 };
      se.count++; se.revenue += total; se.utility += util; bySeller.set(sk, se);
      const ck = s.client_id ?? "none";
      const ce = byClient.get(ck) ?? { clientId: s.client_id ?? null, name: s.clients?.name ?? "Consumidor final", count: 0, revenue: 0 };
      ce.count++; ce.revenue += total; byClient.set(ck, ce);
    }

    const byProduct = new Map<string, { productId: string | null; name: string; qty: number; revenue: number }>();
    for (const it of items ?? []) {
      const key = it.product_id ?? `desc:${it.description}`;
      const rev = Number(it.quantity) * Number(it.unit_price) * (1 - Number(it.discount_pct) / 100);
      const e = byProduct.get(key) ?? { productId: it.product_id ?? null, name: it.description, qty: 0, revenue: 0 };
      e.qty += Number(it.quantity); e.revenue += rev; byProduct.set(key, e);
    }

    return {
      summary: {
        count, revenue: round2(revenue), utility: round2(utility),
        avgTicket: count ? round2(revenue / count) : 0,
        marginPct: netRevenue > 0 ? round2((utility / netRevenue) * 100) : 0,
        costIncompleteCount,
      },
      byDay: [...byDay.values()].map((d) => ({ date: d.date, revenue: round2(d.revenue), utility: round2(d.utility) })).sort((a, b) => (a.date < b.date ? -1 : 1)),
      byProduct: [...byProduct.values()].map((e) => ({ ...e, qty: round2(e.qty), revenue: round2(e.revenue) })).sort((a, b) => b.revenue - a.revenue),
      bySeller: [...bySeller.values()].map((e) => ({ ...e, revenue: round2(e.revenue), utility: round2(e.utility) })).sort((a, b) => b.revenue - a.revenue),
      byClient: [...byClient.values()].map((e) => ({ ...e, revenue: round2(e.revenue) })).sort((a, b) => b.revenue - a.revenue),
    };
  } catch { return EMPTY; }
}

export async function utilityThisMonth(sb: SupabaseClient): Promise<{ utility: number; costIncompleteCount: number }> {
  const r = await salesReport(sb, monthRange(new Date()));
  return { utility: r.summary.utility, costIncompleteCount: r.summary.costIncompleteCount };
}
export async function salesByDayThisWeek(sb: SupabaseClient): Promise<{ date: string; revenue: number; utility: number }[]> {
  return (await salesReport(sb, weekRange(new Date()))).byDay;
}
export async function topProductsThisMonth(sb: SupabaseClient, limit = 5): Promise<{ productId: string | null; name: string; qty: number; revenue: number }[]> {
  return (await salesReport(sb, monthRange(new Date()))).byProduct.slice(0, limit);
}
