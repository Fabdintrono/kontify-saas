import type { SupabaseClient } from "@supabase/supabase-js";
import { round2 } from "@/lib/ventas/totals";
import { formatMoney, formatDateOnly } from "@/lib/format";
import { listStock } from "@/lib/inventario/queries";

export type AttentionItem = {
  kind: "vencida" | "agotado" | "bajo";
  tone: "danger" | "warn"; title: string; detail: string; href: string;
};
const MAX = 8;

/** Ventas vencidas (más antiguas primero), productos agotados y bajo mínimo. Degrada a [] ante error. */
export async function attentionItems(sb: SupabaseClient, today: string): Promise<AttentionItem[]> {
  try {
    const out: AttentionItem[] = [];
    const { data: sales } = await sb.from("sales").select("id, number, balance, due_date, currency, clients(name)")
      .eq("status", "issued").gt("balance", 0).lt("due_date", today).order("due_date").limit(MAX);
    for (const s of (sales ?? []) as any[]) {
      out.push({
        kind: "vencida", tone: "danger",
        title: `Venta #${s.number} vencida`,
        detail: `${s.clients?.name ?? "Consumidor final"} · saldo ${formatMoney(round2(Number(s.balance)), s.currency)} · venció el ${formatDateOnly(s.due_date)}`,
        href: `/operaciones/facturacion/${s.id}`,
      });
    }
    const stock = await listStock(sb);
    for (const r of stock.filter((x) => x.status === "agotado")) {
      if (out.length >= MAX) break;
      out.push({ kind: "agotado", tone: "danger", title: `${r.name} agotado`, detail: `Existencia ${r.qty} · mínimo ${r.minStock}`, href: "/operaciones/inventario" });
    }
    for (const r of stock.filter((x) => x.status === "bajo")) {
      if (out.length >= MAX) break;
      out.push({ kind: "bajo", tone: "warn", title: `${r.name} con stock bajo`, detail: `Existencia ${r.qty} · mínimo ${r.minStock}`, href: "/operaciones/inventario" });
    }
    return out;
  } catch { return []; }
}
