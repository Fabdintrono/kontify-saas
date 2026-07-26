import type { SupabaseClient } from "@supabase/supabase-js";
import { round2 } from "@/lib/ventas/totals";

const NIL_UUID = "00000000-0000-0000-0000-000000000000";
function sanitize(term: string): string { return term.replace(/[%,()*]/g, " ").trim(); }
function todayISO(): string { return new Date().toISOString().slice(0, 10); }

export type ReceivableClientRow = { clientId: string | null; name: string; totalDue: number; overdueAmount: number; oldestDueDate: string | null };

export async function listReceivablesByClient(sb: SupabaseClient, opts: {
  search?: string; filter?: "todos" | "vencidos";
} = {}): Promise<ReceivableClientRow[]> {
  try {
    const { search = "", filter = "todos" } = opts;
    let q = sb.from("sales").select("client_id, total, paid_amount, balance, due_date, clients(name)")
      .eq("status", "issued").gt("balance", 0);
    const s = sanitize(search);
    if (s) {
      const { data: cids } = await sb.from("clients").select("id").ilike("name", `%${s}%`);
      const ids = (cids ?? []).map((c: any) => c.id);
      q = q.in("client_id", ids.length ? ids : [NIL_UUID]);
    }
    const { data, error } = await q;
    if (error || !data) return [];
    const today = todayISO();
    const map = new Map<string, ReceivableClientRow>();
    for (const r of data as any[]) {
      const key = r.client_id ?? "none";
      const cur = map.get(key) ?? { clientId: r.client_id ?? null, name: r.clients?.name ?? "Consumidor final", totalDue: 0, overdueAmount: 0, oldestDueDate: null };
      const bal = Number(r.balance);
      cur.totalDue += bal;
      const overdue = r.due_date && r.due_date < today;
      if (overdue) {
        cur.overdueAmount += bal;
        if (!cur.oldestDueDate || r.due_date < cur.oldestDueDate) cur.oldestDueDate = r.due_date;
      }
      map.set(key, cur);
    }
    let rows = [...map.values()].map((r) => ({ ...r, totalDue: round2(r.totalDue), overdueAmount: round2(r.overdueAmount) }));
    if (filter === "vencidos") rows = rows.filter((r) => r.overdueAmount > 0);
    return rows.sort((a, b) => b.totalDue - a.totalDue);
  } catch { return []; }
}

export async function getClientReceivable(sb: SupabaseClient, clientId: string): Promise<{
  clientName: string | null;
  rows: { saleId: string; number: number | null; total: number; paid: number; balance: number; dueDate: string | null; overdue: boolean }[];
  totalDue: number; overdueAmount: number;
}> {
  try {
    const { data, error } = await sb.from("sales")
      .select("id, number, total, paid_amount, balance, due_date, clients(name)")
      .eq("client_id", clientId).eq("status", "issued").gt("balance", 0).order("due_date", { nullsFirst: false });
    if (error || !data) return { clientName: null, rows: [], totalDue: 0, overdueAmount: 0 };
    const today = todayISO();
    let totalDue = 0, overdueAmount = 0;
    const rows = (data as any[]).map((r) => {
      const balance = Number(r.balance);
      const overdue = !!(r.due_date && r.due_date < today);
      totalDue += balance;
      if (overdue) overdueAmount += balance;
      return { saleId: r.id, number: r.number, total: Number(r.total), paid: Number(r.paid_amount), balance, dueDate: r.due_date, overdue };
    });
    return { clientName: (data[0] as any)?.clients?.name ?? null, rows, totalDue: round2(totalDue), overdueAmount: round2(overdueAmount) };
  } catch { return { clientName: null, rows: [], totalDue: 0, overdueAmount: 0 }; }
}

export async function listPayments(sb: SupabaseClient, saleId: string): Promise<{
  id: string; amount: number; method: string | null; reference: string | null; paidAt: string; voided: boolean;
}[]> {
  const { data, error } = await sb.from("payments").select("id, amount, method, reference, paid_at, voided")
    .eq("sale_id", saleId).order("paid_at").order("created_at");
  if (error || !data) return [];
  return data.map((p: any) => ({ id: p.id, amount: Number(p.amount), method: p.method, reference: p.reference, paidAt: p.paid_at, voided: p.voided }));
}

// Total por cobrar + porción vencida. La consumirá el dashboard ("Requieren atención") en un plan posterior.
export async function receivablesKpi(sb: SupabaseClient): Promise<{ total: number; overdue: number }> {
  try {
    const { data, error } = await sb.from("sales").select("balance, due_date").eq("status", "issued").gt("balance", 0);
    if (error || !data) return { total: 0, overdue: 0 };
    const today = todayISO();
    let total = 0, overdue = 0;
    for (const r of data as any[]) { const b = Number(r.balance); total += b; if (r.due_date && r.due_date < today) overdue += b; }
    return { total: round2(total), overdue: round2(overdue) };
  } catch { return { total: 0, overdue: 0 }; }
}
