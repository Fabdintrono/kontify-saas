import type { SupabaseClient } from "@supabase/supabase-js";
import { round2 } from "@/lib/ventas/totals";
import { formatMoney, formatDateOnly } from "@/lib/format";
import { isDateISO } from "@/lib/tz";
import { listStock } from "@/lib/inventario/queries";

export type AttentionItem = {
  kind: "vencida" | "agotado" | "bajo";
  tone: "danger" | "warn"; title: string; detail: string; href: string;
};

/** Cupo total del panel. */
const MAX = 8;
/** Cupo de ventas vencidas: deja siempre al menos 3 huecos para el inventario. */
const MAX_VENCIDAS = 5;

const stockItem = (kind: "agotado" | "bajo", r: { name: string; qty: number; minStock: number }): AttentionItem => ({
  kind, tone: kind === "agotado" ? "danger" : "warn",
  title: kind === "agotado" ? `${r.name} agotado` : `${r.name} con stock bajo`,
  detail: `Existencia ${r.qty} · mínimo ${r.minStock}`,
  href: `/operaciones/inventario?status=${kind}`,
});

/** Ventas vencidas (más antiguas primero), productos agotados y bajo mínimo.
 *  Cupo 5 vencidas + el resto de inventario, hasta MAX. Solo alerta de productos con mínimo
 *  declarado (`min_stock > 0`): sin mínimo no hay nada que reponer. */
export async function attentionItems(sb: SupabaseClient, today: string): Promise<AttentionItem[]> {
  if (!isDateISO(today)) throw new Error(`Fecha local inválida: ${today}`);
  const out: AttentionItem[] = [];
  const { data: sales, error } = await sb.from("sales").select("id, number, balance, due_date, currency, clients(name)")
    .eq("status", "issued").gt("balance", 0).lt("due_date", today).order("due_date").limit(MAX_VENCIDAS);
  // Media lista es peor que ninguna: el panel diría «todo en orden» con ventas vencidas detrás.
  if (error) { console.error("attentionItems", error); return []; }
  for (const s of (sales ?? []) as any[]) {
    out.push({
      kind: "vencida", tone: "danger",
      title: `Venta #${s.number} vencida`,
      detail: `${s.clients?.name ?? "Consumidor final"} · saldo ${formatMoney(round2(Number(s.balance)), s.currency)} · venció el ${formatDateOnly(s.due_date)}`,
      href: `/operaciones/facturacion/${s.id}`,
    });
  }

  const stock = (await listStock(sb)).filter((r) => r.minStock > 0);
  for (const kind of ["agotado", "bajo"] as const) {
    for (const r of stock.filter((x) => x.status === kind)) {
      if (out.length >= MAX) return out;
      out.push(stockItem(kind, r));
    }
  }
  return out;
}
