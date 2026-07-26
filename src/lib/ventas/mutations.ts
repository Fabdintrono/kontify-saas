import type { SupabaseClient } from "@supabase/supabase-js";
import type { SaleSaveInput, EmitInput } from "@/lib/ventas/schema";
import { computeSaleTotals } from "@/lib/ventas/totals";
import { applySaleStockOut, reverseSaleStock } from "@/lib/inventario/mutations";

function headerTotals(input: SaleSaveInput) {
  const t = computeSaleTotals(
    input.items.map((i) => ({ quantity: i.quantity, unitPrice: i.unitPrice, discountPct: i.discountPct, taxRate: i.taxRate })),
    input.globalDiscountPct,
  );
  return { subtotal: t.subtotal, discount_total: t.discountTotal, tax_total: t.taxTotal, total: t.total };
}

async function replaceItems(sb: SupabaseClient, saleId: string, tenantId: string, input: SaleSaveInput) {
  const { error: delErr } = await sb.from("sale_items").delete().eq("sale_id", saleId);
  if (delErr) throw delErr;
  if (input.items.length === 0) return;
  const rows = input.items.map((i, idx) => ({
    tenant_id: tenantId, sale_id: saleId, product_id: i.productId ?? null,
    description: i.description, quantity: i.quantity, unit_price: i.unitPrice,
    discount_pct: i.discountPct, tax_rate: i.taxRate, position: idx,
  }));
  const { error } = await sb.from("sale_items").insert(rows);
  if (error) throw error;
}

export async function createDraft(
  sb: SupabaseClient, tenantId: string, userId: string, currency: string, input: SaleSaveInput,
): Promise<string> {
  const { data, error } = await sb.from("sales").insert({
    tenant_id: tenantId, created_by: userId, branch_id: input.branchId, client_id: input.clientId ?? null,
    status: "draft", currency, global_discount_pct: input.globalDiscountPct, notes: input.notes ?? null,
    ...headerTotals(input),
  }).select("id").single();
  if (error) throw error;
  await replaceItems(sb, data.id, tenantId, input);
  return data.id as string;
}

export async function updateDraft(sb: SupabaseClient, id: string, tenantId: string, input: SaleSaveInput): Promise<void> {
  const { data, error } = await sb.from("sales").update({
    branch_id: input.branchId, client_id: input.clientId ?? null,
    global_discount_pct: input.globalDiscountPct, notes: input.notes ?? null,
    ...headerTotals(input), updated_at: new Date().toISOString(),
  }).eq("id", id).eq("status", "draft").select("id");
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("La venta no es un borrador editable");
  await replaceItems(sb, id, tenantId, input);
}

export async function deleteDraft(sb: SupabaseClient, id: string): Promise<void> {
  const { data, error } = await sb.from("sales").delete().eq("id", id).eq("status", "draft").select("id");
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("Solo se pueden borrar borradores");
}

export async function emitSale(sb: SupabaseClient, id: string, payment: EmitInput): Promise<void> {
  const { data: sale, error: readErr } = await sb.from("sales")
    .select("id, status, total, tenant_id, created_by").eq("id", id).maybeSingle();
  if (readErr) throw readErr;
  if (!sale || sale.status !== "draft") throw new Error("Solo se emiten borradores");
  const { count } = await sb.from("sale_items").select("id", { count: "exact", head: true }).eq("sale_id", id);
  if (!count) throw new Error("La venta no tiene líneas");
  const { data: num, error: numErr } = await sb.rpc("next_sale_number");
  if (numErr) throw numErr;

  const { data, error } = await sb.from("sales").update({
    number: num, status: "issued", issued_at: new Date().toISOString(),
    payment_method: payment.paymentType === "contado" ? (payment.paymentMethod ?? null) : null,
    due_date: payment.paymentType === "credito" ? (payment.dueDate ?? null) : null,
    updated_at: new Date().toISOString(),
  }).eq("id", id).eq("status", "draft").select("id");
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("La venta ya no es un borrador");

  // El contado se registra como un cobro por el total → el trigger fija paid_amount.
  if (payment.paymentType === "contado") {
    const { error: payErr } = await sb.from("payments").insert({
      tenant_id: sale.tenant_id, sale_id: id, amount: Number(sale.total),
      method: payment.paymentMethod ?? null, paid_at: new Date().toISOString().slice(0, 10),
      created_by: sale.created_by,
    });
    if (payErr) throw payErr;
  }

  // Descuenta stock de los ítems 'good' de la venta (permite negativo).
  await applySaleStockOut(sb, id);
}

export async function voidSale(sb: SupabaseClient, id: string): Promise<void> {
  // Auto-anular cobros del contado (el pago se revierte junto con la venta).
  const { data: sale } = await sb.from("sales").select("payment_method").eq("id", id).maybeSingle();
  if (sale?.payment_method) {
    await sb.from("payments").update({ voided: true }).eq("sale_id", id).eq("voided", false);
  }
  const { count } = await sb.from("payments").select("id", { count: "exact", head: true })
    .eq("sale_id", id).eq("voided", false);
  if (count && count > 0) throw new Error("Anula primero los cobros de esta venta");
  const { data, error } = await sb.from("sales").update({ status: "void", updated_at: new Date().toISOString() })
    .eq("id", id).eq("status", "issued").select("id");
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("Solo se anulan ventas emitidas");
  await reverseSaleStock(sb, id);
}
