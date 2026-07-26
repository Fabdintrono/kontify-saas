import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdjustmentInput } from "@/lib/inventario/schema";

export async function registerAdjustment(
  sb: SupabaseClient, tenantId: string, userId: string, input: AdjustmentInput,
): Promise<string> {
  const qtyDelta = input.direction === "in" ? input.quantity : -input.quantity;
  const { data, error } = await sb.from("stock_movements").insert({
    tenant_id: tenantId, product_id: input.productId, branch_id: input.branchId,
    qty_delta: qtyDelta, type: "adjustment", reason: input.reason ?? null, created_by: userId,
  }).select("id").single();
  if (error) throw error;
  return data.id as string;
}

// Lee los ítems 'good' de la venta y genera un movimiento por cada uno. `sign` = -1 (salida) o +1 (reposición).
async function saleMovements(sb: SupabaseClient, saleId: string, sign: 1 | -1, type: "sale" | "sale_void") {
  const { data: sale, error: sErr } = await sb.from("sales")
    .select("tenant_id, branch_id, created_by").eq("id", saleId).maybeSingle();
  if (sErr) throw sErr;
  if (!sale) return;
  const { data: items, error: iErr } = await sb.from("sale_items")
    .select("product_id, quantity, products(kind)").eq("sale_id", saleId).not("product_id", "is", null);
  if (iErr) throw iErr;
  const rows = (items ?? [])
    .filter((it: any) => it.products?.kind === "good")
    .map((it: any) => ({
      tenant_id: sale.tenant_id, product_id: it.product_id, branch_id: sale.branch_id,
      qty_delta: sign * Number(it.quantity), type, sale_id: saleId, created_by: sale.created_by,
    }));
  if (rows.length === 0) return;
  const { error } = await sb.from("stock_movements").insert(rows);
  if (error) throw error;
}

export async function applySaleStockOut(sb: SupabaseClient, saleId: string): Promise<void> {
  await saleMovements(sb, saleId, -1, "sale");
}

export async function reverseSaleStock(sb: SupabaseClient, saleId: string): Promise<void> {
  await saleMovements(sb, saleId, 1, "sale_void");
}
