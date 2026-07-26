import type { SupabaseClient } from "@supabase/supabase-js";
import type { QuoteSaveInput } from "@/lib/presupuestos/schema";
import type { SaleSaveInput } from "@/lib/ventas/schema";
import { computeSaleTotals } from "@/lib/ventas/totals";
import { createDraft as createSaleDraft } from "@/lib/ventas/mutations";

function headerTotals(input: QuoteSaveInput) {
  const t = computeSaleTotals(
    input.items.map((i) => ({ quantity: i.quantity, unitPrice: i.unitPrice, discountPct: i.discountPct, taxRate: i.taxRate })),
    input.globalDiscountPct,
  );
  return { subtotal: t.subtotal, discount_total: t.discountTotal, tax_total: t.taxTotal, total: t.total };
}

async function replaceItems(sb: SupabaseClient, quoteId: string, tenantId: string, input: QuoteSaveInput) {
  const { error: delErr } = await sb.from("quote_items").delete().eq("quote_id", quoteId);
  if (delErr) throw delErr;
  if (input.items.length === 0) return;
  const rows = input.items.map((i, idx) => ({
    tenant_id: tenantId, quote_id: quoteId, product_id: i.productId ?? null,
    description: i.description, quantity: i.quantity, unit_price: i.unitPrice,
    discount_pct: i.discountPct, tax_rate: i.taxRate, position: idx,
  }));
  const { error } = await sb.from("quote_items").insert(rows);
  if (error) throw error;
}

export async function createDraft(
  sb: SupabaseClient, tenantId: string, userId: string, currency: string, input: QuoteSaveInput,
): Promise<string> {
  const { data, error } = await sb.from("quotes").insert({
    tenant_id: tenantId, created_by: userId, branch_id: input.branchId, client_id: input.clientId ?? null,
    status: "draft", currency, global_discount_pct: input.globalDiscountPct,
    valid_until: input.validUntil ?? null, notes: input.notes ?? null, ...headerTotals(input),
  }).select("id").single();
  if (error) throw error;
  await replaceItems(sb, data.id, tenantId, input);
  return data.id as string;
}

export async function updateDraft(sb: SupabaseClient, id: string, tenantId: string, input: QuoteSaveInput): Promise<void> {
  const { data, error } = await sb.from("quotes").update({
    branch_id: input.branchId, client_id: input.clientId ?? null,
    global_discount_pct: input.globalDiscountPct, valid_until: input.validUntil ?? null,
    notes: input.notes ?? null, ...headerTotals(input), updated_at: new Date().toISOString(),
  }).eq("id", id).eq("status", "draft").select("id");
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("El presupuesto no es un borrador editable");
  await replaceItems(sb, id, tenantId, input);
}

export async function deleteDraft(sb: SupabaseClient, id: string): Promise<void> {
  const { data, error } = await sb.from("quotes").delete().eq("id", id).eq("status", "draft").select("id");
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("Solo se pueden borrar borradores");
}

export async function sendQuote(sb: SupabaseClient, id: string): Promise<void> {
  const { data: q, error: readErr } = await sb.from("quotes").select("id, status").eq("id", id).maybeSingle();
  if (readErr) throw readErr;
  if (!q || q.status !== "draft") throw new Error("Solo se envían borradores");
  const { count } = await sb.from("quote_items").select("id", { count: "exact", head: true }).eq("quote_id", id);
  if (!count) throw new Error("El presupuesto no tiene líneas");
  const { data: num, error: numErr } = await sb.rpc("next_quote_number");
  if (numErr) throw numErr;
  const { data, error } = await sb.from("quotes").update({
    number: num, status: "sent", updated_at: new Date().toISOString(),
  }).eq("id", id).eq("status", "draft").select("id");
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("El presupuesto ya no es un borrador");
}

export async function setQuoteStatus(sb: SupabaseClient, id: string, status: "accepted" | "rejected"): Promise<void> {
  const { data, error } = await sb.from("quotes").update({ status, updated_at: new Date().toISOString() })
    .eq("id", id).in("status", ["sent", "accepted"]).select("id");
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("Solo se marca un presupuesto enviado o aceptado");
}

export async function convertToSale(
  sb: SupabaseClient, tenantId: string, userId: string, currency: string, id: string,
): Promise<string> {
  const { data: q, error: readErr } = await sb.from("quotes")
    .select("id, status, branch_id, client_id, global_discount_pct, notes, converted_sale_id").eq("id", id).maybeSingle();
  if (readErr) throw readErr;
  if (!q || !["sent", "accepted"].includes(q.status)) throw new Error("Solo se convierten presupuestos enviados o aceptados");
  if (q.converted_sale_id) throw new Error("El presupuesto ya fue convertido");

  const { data: items, error: iErr } = await sb.from("quote_items")
    .select("product_id, description, quantity, unit_price, discount_pct, tax_rate").eq("quote_id", id).order("position");
  if (iErr) throw iErr;

  const input: SaleSaveInput = {
    clientId: q.client_id, branchId: q.branch_id, globalDiscountPct: Number(q.global_discount_pct),
    notes: q.notes ?? undefined,
    items: (items ?? []).map((it: any) => ({
      productId: it.product_id ?? null, description: it.description, quantity: Number(it.quantity),
      unitPrice: Number(it.unit_price), discountPct: Number(it.discount_pct), taxRate: Number(it.tax_rate),
    })),
  };
  const saleId = await createSaleDraft(sb, tenantId, userId, currency, input);

  const { data, error } = await sb.from("quotes")
    .update({ status: "converted", converted_sale_id: saleId, updated_at: new Date().toISOString() })
    .eq("id", id).is("converted_sale_id", null).select("id");
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("El presupuesto ya fue convertido");
  return saleId;
}
