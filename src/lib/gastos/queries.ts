import type { SupabaseClient } from "@supabase/supabase-js";
import { round2 } from "@/lib/ventas/totals";
import { monthRange, sameSpanLastMonth, type DateRange } from "@/lib/reportes/ranges";
import { resolveSort, type SortSpec } from "@/lib/sorting";
import { localDateISO, assertDateISO } from "@/lib/tz";
import type { Frecuencia } from "./schema";

export type ExpenseRow = {
  id: string; description: string; amount: number; currency: string;
  spentOn: string; categoryId: string | null; categoryName: string | null;
  paymentMethod: string | null; supplier: string | null; notes: string | null;
  /** Nació de un gasto fijo; se marca en la lista para que se entienda de dónde salió. */
  fromRecurring: boolean;
};

export type RecurringRow = {
  id: string; description: string; amount: number; currency: string;
  frequency: Frecuencia; nextDue: string; anchorDay: number; active: boolean;
  categoryId: string | null; categoryName: string | null;
};

export const EXPENSES_SORT: SortSpec = {
  default: { key: "date", dir: "desc" },
  columns: {
    date: { column: "spent_on", natural: "desc" },
    description: { column: "description", natural: "asc" },
    category: { column: "expense_categories(name)", natural: "asc", nullsFirst: false },
    amount: { column: "amount", natural: "desc" },
  },
};

function sanitize(term: string): string { return term.replace(/[%,()*]/g, " ").trim(); }

const SELECT_GASTO =
  "id, description, amount, currency, spent_on, category_id, payment_method, supplier, notes, recurring_id, expense_categories(name)";

function aFila(r: any): ExpenseRow {
  return {
    id: r.id, description: r.description, amount: Number(r.amount), currency: r.currency,
    spentOn: r.spent_on, categoryId: r.category_id, categoryName: r.expense_categories?.name ?? null,
    paymentMethod: r.payment_method, supplier: r.supplier, notes: r.notes,
    fromRecurring: r.recurring_id != null,
  };
}

export async function listExpenses(sb: SupabaseClient, opts: {
  search?: string; categoryId?: string | null; range?: DateRange;
  page?: number; pageSize?: number; sort?: string; dir?: string;
} = {}): Promise<{ rows: ExpenseRow[]; total: number; page: number; pageSize: number; suma: number }> {
  const { search = "", categoryId = null, range, page = 1, pageSize = 20 } = opts;
  const order = resolveSort(EXPENSES_SORT, opts.sort, opts.dir);

  let q = sb.from("expenses").select(SELECT_GASTO, { count: "exact" });
  if (categoryId) q = q.eq("category_id", categoryId);
  if (range) {
    assertDateISO(range.from); assertDateISO(range.to);
    q = q.gte("spent_on", range.from).lte("spent_on", range.to);
  }
  const s = sanitize(search);
  if (s) q = q.or(`description.ilike.%${s}%,supplier.ilike.%${s}%,notes.ilike.%${s}%`);

  const from = (page - 1) * pageSize;
  q = q.order(order.column, { ascending: order.ascending, nullsFirst: order.nullsFirst ?? false });
  if (order.column !== "spent_on") q = q.order("spent_on", { ascending: false });
  q = q.range(from, from + pageSize - 1);

  const { data, error, count } = await q;
  if (error) throw error;

  // La suma es del filtro entero, no de la página: si no, el total cambiaría al pasar página.
  const suma = await sumaDeGastos(sb, { categoryId, range, search: s });
  return { rows: (data ?? []).map(aFila), total: count ?? 0, page, pageSize, suma };
}

async function sumaDeGastos(sb: SupabaseClient, opts: {
  categoryId?: string | null; range?: DateRange; search?: string;
}): Promise<number> {
  try {
    let q = sb.from("expenses").select("amount");
    if (opts.categoryId) q = q.eq("category_id", opts.categoryId);
    if (opts.range) q = q.gte("spent_on", opts.range.from).lte("spent_on", opts.range.to);
    if (opts.search) q = q.or(`description.ilike.%${opts.search}%,supplier.ilike.%${opts.search}%,notes.ilike.%${opts.search}%`);
    const { data, error } = await q;
    if (error || !data) return 0;
    return round2(data.reduce((s: number, r: any) => s + Number(r.amount), 0));
  } catch { return 0; }
}

export async function getExpense(sb: SupabaseClient, id: string): Promise<ExpenseRow | null> {
  const { data, error } = await sb.from("expenses").select(SELECT_GASTO).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? aFila(data) : null;
}

export async function listExpenseCategories(sb: SupabaseClient, opts: { includeInactive?: boolean } = {}) {
  let q = sb.from("expense_categories").select("id, name, active").order("name");
  if (!opts.includeInactive) q = q.eq("active", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as { id: string; name: string; active: boolean }[];
}

const SELECT_FIJO =
  "id, description, amount, currency, frequency, next_due, anchor_day, active, category_id, expense_categories(name)";

const aFijo = (r: any): RecurringRow => ({
  id: r.id, description: r.description, amount: Number(r.amount), currency: r.currency,
  frequency: r.frequency, nextDue: r.next_due, anchorDay: Number(r.anchor_day), active: r.active,
  categoryId: r.category_id, categoryName: r.expense_categories?.name ?? null,
});

export async function listRecurring(sb: SupabaseClient, opts: { includeInactive?: boolean } = {}): Promise<RecurringRow[]> {
  let q = sb.from("recurring_expenses").select(SELECT_FIJO).order("next_due");
  if (!opts.includeInactive) q = q.eq("active", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(aFijo);
}

export async function getRecurring(sb: SupabaseClient, id: string): Promise<RecurringRow | null> {
  const { data, error } = await sb.from("recurring_expenses").select(SELECT_FIJO).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? aFijo(data) : null;
}

/** Gastos del mes, con el mismo tramo del mes pasado para poder comparar.
 *  Degrada a ceros: un rol sin acceso a gastos no debe romper el inicio. */
export async function expensesKpi(sb: SupabaseClient, tz: string): Promise<{ mes: number; tramoAnterior: number }> {
  try {
    const actual = monthRange(new Date(), tz);
    const previo = sameSpanLastMonth(localDateISO(new Date(), tz));
    const [a, b] = await Promise.all([
      sb.from("expenses").select("amount").gte("spent_on", actual.from).lte("spent_on", actual.to),
      sb.from("expenses").select("amount").gte("spent_on", previo.from).lte("spent_on", previo.to),
    ]);
    if (a.error || b.error) return { mes: 0, tramoAnterior: 0 };
    const sumar = (d: any[] | null) => round2((d ?? []).reduce((s, r) => s + Number(r.amount), 0));
    return { mes: sumar(a.data), tramoAnterior: sumar(b.data) };
  } catch (e) { console.error("expensesKpi", e); return { mes: 0, tramoAnterior: 0 }; }
}

/** Gastos fijos que ya vencieron o vencen dentro de `dias`. Es lo que llena la
 *  tarjeta «Por pagar», que hasta ahora estaba vacía. */
export async function upcomingRecurring(sb: SupabaseClient, hoyISO: string, dias = 7): Promise<{
  total: number; vencidos: number; filas: RecurringRow[];
}> {
  const vacio = { total: 0, vencidos: 0, filas: [] as RecurringRow[] };
  try {
    assertDateISO(hoyISO);
    const [a, m, d] = hoyISO.split("-").map(Number);
    const limite = new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10);
    const { data, error } = await sb.from("recurring_expenses").select(SELECT_FIJO)
      .eq("active", true).lte("next_due", limite).order("next_due");
    if (error || !data) return vacio;
    const filas = data.map(aFijo);
    return {
      total: round2(filas.reduce((s, f) => s + f.amount, 0)),
      vencidos: filas.filter((f) => f.nextDue < hoyISO).length,
      filas,
    };
  } catch (e) { console.error("upcomingRecurring", e); return vacio; }
}

/** Reparto por categoría del período, de mayor a menor. Para saber en qué se va el dinero. */
export async function expensesByCategory(sb: SupabaseClient, range: DateRange): Promise<
  { categoryId: string | null; name: string; total: number }[]
> {
  try {
    assertDateISO(range.from); assertDateISO(range.to);
    const { data, error } = await sb.from("expenses")
      .select("amount, category_id, expense_categories(name)")
      .gte("spent_on", range.from).lte("spent_on", range.to);
    if (error || !data) return [];
    const map = new Map<string, { categoryId: string | null; name: string; total: number }>();
    for (const r of data as any[]) {
      const key = r.category_id ?? "none";
      const cur = map.get(key) ?? { categoryId: r.category_id ?? null, name: r.expense_categories?.name ?? "Sin categoría", total: 0 };
      cur.total += Number(r.amount);
      map.set(key, cur);
    }
    return [...map.values()].map((x) => ({ ...x, total: round2(x.total) })).sort((a, b) => b.total - a.total);
  } catch { return []; }
}
