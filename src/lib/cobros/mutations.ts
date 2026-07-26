import type { SupabaseClient } from "@supabase/supabase-js";
import type { PaymentInput } from "@/lib/cobros/schema";

export async function registerPayment(
  sb: SupabaseClient, tenantId: string, userId: string, input: PaymentInput,
): Promise<string> {
  const { data: sale, error: readErr } = await sb.from("sales")
    .select("id, status, balance").eq("id", input.saleId).maybeSingle();
  if (readErr) throw readErr;
  if (!sale || sale.status !== "issued") throw new Error("Solo se cobran ventas emitidas");
  const balance = Number(sale.balance);
  if (input.amount > balance + 1e-9) throw new Error("El abono supera el saldo pendiente");

  const { data, error } = await sb.from("payments").insert({
    tenant_id: tenantId, sale_id: input.saleId, amount: input.amount,
    method: input.method ?? null, reference: input.reference ?? null,
    paid_at: input.paidAt ?? new Date().toISOString().slice(0, 10),
    notes: input.notes ?? null, created_by: userId,
  }).select("id").single();
  if (error) throw error;
  return data.id as string;
}

export async function voidPayment(sb: SupabaseClient, id: string): Promise<void> {
  const { data, error } = await sb.from("payments")
    .update({ voided: true }).eq("id", id).eq("voided", false).select("id");
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("El cobro ya estaba anulado o no existe");
}

export async function setDueDate(sb: SupabaseClient, saleId: string, dueDate: string | null): Promise<void> {
  const { data, error } = await sb.from("sales")
    .update({ due_date: dueDate, updated_at: new Date().toISOString() })
    .eq("id", saleId).eq("status", "issued").select("id");
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("Solo se fija vencimiento en ventas emitidas");
}
