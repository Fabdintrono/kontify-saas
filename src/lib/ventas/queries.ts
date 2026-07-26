import type { SupabaseClient } from "@supabase/supabase-js";
import { computeSaleTotals, round2 } from "@/lib/ventas/totals";

export type SaleStatusFilter = "borradores" | "emitidas" | "anuladas" | "todas";
export type SalePaymentFilter = "pendientes" | "todas";
export type SaleListRow = {
  id: string; number: number | null; status: "draft" | "issued" | "void";
  clientName: string | null; branchName: string | null;
  total: number; balance: number; currency: string; issuedAt: string | null; createdAt: string;
};

const STATUS_MAP: Record<string, string> = { borradores: "draft", emitidas: "issued", anuladas: "void" };
const NIL_UUID = "00000000-0000-0000-0000-000000000000";
function sanitize(term: string): string { return term.replace(/[%,()*]/g, " ").trim(); }
function monthStartISO(): string { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d.toISOString(); }

export async function listSales(sb: SupabaseClient, opts: {
  search?: string; status?: SaleStatusFilter; payment?: SalePaymentFilter; page?: number; pageSize?: number;
} = {}): Promise<{ rows: SaleListRow[]; total: number; page: number; pageSize: number }> {
  const { search = "", status = "todas", payment = "todas", page = 1, pageSize = 20 } = opts;
  let q = sb.from("sales").select(
    "id, number, status, total, paid_amount, currency, issued_at, created_at, clients(name), branches(name)",
    { count: "exact" },
  );
  if (STATUS_MAP[status]) q = q.eq("status", STATUS_MAP[status]);
  if (payment === "pendientes") q = q.eq("status", "issued").gt("balance", 0);
  const s = sanitize(search);
  if (s) {
    if (/^\d+$/.test(s)) {
      q = q.eq("number", Number(s));
    } else {
      const { data: cids } = await sb.from("clients").select("id").ilike("name", `%${s}%`);
      const ids = (cids ?? []).map((c: any) => c.id);
      q = q.in("client_id", ids.length ? ids : [NIL_UUID]);
    }
  }
  const from = (page - 1) * pageSize;
  q = q.order("created_at", { ascending: false }).range(from, from + pageSize - 1);
  const { data, error, count } = await q;
  if (error) throw error;
  const rows: SaleListRow[] = (data ?? []).map((r: any) => ({
    id: r.id, number: r.number, status: r.status,
    clientName: r.clients?.name ?? null, branchName: r.branches?.name ?? null,
    total: Number(r.total), balance: round2(Number(r.total) - Number(r.paid_amount)),
    currency: r.currency, issuedAt: r.issued_at, createdAt: r.created_at,
  }));
  return { rows, total: count ?? 0, page, pageSize };
}

export async function getSale(sb: SupabaseClient, id: string) {
  const { data, error } = await sb.from("sales").select("*, clients(name), branches(name)").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { data: items } = await sb.from("sale_items").select("*").eq("sale_id", id).order("position");
  const computed = computeSaleTotals(
    (items ?? []).map((i: any) => ({
      quantity: Number(i.quantity), unitPrice: Number(i.unit_price),
      discountPct: Number(i.discount_pct), taxRate: Number(i.tax_rate),
    })),
    Number(data.global_discount_pct),
  );
  return { ...(data as any), items: items ?? [], computed };
}

export async function salesKpi(sb: SupabaseClient): Promise<{ monthTotal: number; avgTicket: number }> {
  try {
    const { data, error } = await sb.from("sales").select("total").eq("status", "issued").gte("issued_at", monthStartISO());
    if (error || !data) return { monthTotal: 0, avgTicket: 0 };
    const monthTotal = data.reduce((s: number, r: any) => s + Number(r.total), 0);
    return { monthTotal: round2(monthTotal), avgTicket: data.length ? round2(monthTotal / data.length) : 0 };
  } catch { return { monthTotal: 0, avgTicket: 0 }; }
}

export async function receivablesTotal(sb: SupabaseClient): Promise<{ total: number }> {
  try {
    const { data, error } = await sb.from("sales").select("total, paid_amount").eq("status", "issued");
    if (error || !data) return { total: 0 };
    return { total: round2(data.reduce((s: number, r: any) => s + (Number(r.total) - Number(r.paid_amount)), 0)) };
  } catch { return { total: 0 }; }
}

export async function salesByClient(sb: SupabaseClient, clientId: string): Promise<{
  list: { id: string; number: number | null; total: number; balance: number; issuedAt: string | null }[];
  purchasedTotal: number; receivable: number;
}> {
  try {
    const { data, error } = await sb.from("sales").select("id, number, total, paid_amount, issued_at")
      .eq("client_id", clientId).eq("status", "issued").order("issued_at", { ascending: false });
    if (error || !data) return { list: [], purchasedTotal: 0, receivable: 0 };
    const purchasedTotal = data.reduce((s: number, r: any) => s + Number(r.total), 0);
    const receivable = data.reduce((s: number, r: any) => s + (Number(r.total) - Number(r.paid_amount)), 0);
    return {
      list: data.map((r: any) => ({ id: r.id, number: r.number, total: Number(r.total), balance: round2(Number(r.total) - Number(r.paid_amount)), issuedAt: r.issued_at })),
      purchasedTotal: round2(purchasedTotal), receivable: round2(receivable),
    };
  } catch { return { list: [], purchasedTotal: 0, receivable: 0 }; }
}

// Listas ligeras para el builder (client-side search; caps razonables para el núcleo).
export async function listActiveClientsLite(sb: SupabaseClient) {
  const { data } = await sb.from("clients").select("id, name").eq("active", true).order("name").limit(500);
  return (data ?? []) as { id: string; name: string }[];
}
export async function listActiveProductsLite(sb: SupabaseClient) {
  const { data } = await sb.from("products").select("id, name, price, unit, tax_rates(rate)").eq("active", true).order("name").limit(1000);
  return (data ?? []).map((p: any) => ({ id: p.id, name: p.name, price: Number(p.price), unit: p.unit, taxRate: p.tax_rates ? Number(p.tax_rates.rate) : 0 }));
}
export async function listBranches(sb: SupabaseClient) {
  const { data } = await sb.from("branches").select("id, name, is_main").order("is_main", { ascending: false });
  return (data ?? []) as { id: string; name: string; is_main: boolean }[];
}
