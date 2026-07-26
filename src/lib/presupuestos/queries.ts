import type { SupabaseClient } from "@supabase/supabase-js";
import { computeSaleTotals } from "@/lib/ventas/totals";

export type QuoteStatusFilter = "borradores" | "enviados" | "aceptados" | "rechazados" | "convertidos" | "todos";
export type QuoteListRow = {
  id: string; number: number | null; status: string;
  clientName: string | null; branchName: string | null;
  total: number; currency: string; validUntil: string | null; createdAt: string;
};

const STATUS_MAP: Record<string, string> = {
  borradores: "draft", enviados: "sent", aceptados: "accepted", rechazados: "rejected", convertidos: "converted",
};
const NIL_UUID = "00000000-0000-0000-0000-000000000000";
function sanitize(term: string): string { return term.replace(/[%,()*]/g, " ").trim(); }

export async function listQuotes(sb: SupabaseClient, opts: {
  search?: string; status?: QuoteStatusFilter; page?: number; pageSize?: number;
} = {}): Promise<{ rows: QuoteListRow[]; total: number; page: number; pageSize: number }> {
  const { search = "", status = "todos", page = 1, pageSize = 20 } = opts;
  let q = sb.from("quotes").select(
    "id, number, status, total, currency, valid_until, created_at, clients(name), branches(name)",
    { count: "exact" },
  );
  if (STATUS_MAP[status]) q = q.eq("status", STATUS_MAP[status]);
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
  const rows: QuoteListRow[] = (data ?? []).map((r: any) => ({
    id: r.id, number: r.number, status: r.status,
    clientName: r.clients?.name ?? null, branchName: r.branches?.name ?? null,
    total: Number(r.total), currency: r.currency, validUntil: r.valid_until, createdAt: r.created_at,
  }));
  return { rows, total: count ?? 0, page, pageSize };
}

export async function getQuote(sb: SupabaseClient, id: string) {
  const { data, error } = await sb.from("quotes").select("*, clients(name), branches(name)").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { data: items } = await sb.from("quote_items").select("*").eq("quote_id", id).order("position");
  const computed = computeSaleTotals(
    (items ?? []).map((i: any) => ({
      quantity: Number(i.quantity), unitPrice: Number(i.unit_price),
      discountPct: Number(i.discount_pct), taxRate: Number(i.tax_rate),
    })),
    Number(data.global_discount_pct),
  );
  return { ...(data as any), items: items ?? [], computed };
}
