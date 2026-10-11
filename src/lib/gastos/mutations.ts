import type { SupabaseClient } from "@supabase/supabase-js";
import { siguienteFecha } from "./schedule";
import type { ExpenseInput, RecurringInput } from "./schema";

const filaGasto = (input: ExpenseInput, currency: string) => ({
  description: input.description,
  amount: input.amount,
  currency,
  spent_on: input.spentOn,
  category_id: input.categoryId ?? null,
  payment_method: input.paymentMethod ?? null,
  supplier: input.supplier ?? null,
  notes: input.notes ?? null,
});

export async function createExpense(
  sb: SupabaseClient, tenantId: string, userId: string, branchId: string | null,
  currency: string, input: ExpenseInput,
): Promise<string> {
  const { data, error } = await sb.from("expenses")
    .insert({ tenant_id: tenantId, created_by: userId, branch_id: branchId, ...filaGasto(input, currency) })
    .select("id").single();
  if (error) throw error;
  return data.id as string;
}

export async function updateExpense(sb: SupabaseClient, id: string, currency: string, input: ExpenseInput): Promise<void> {
  const { error } = await sb.from("expenses")
    .update({ ...filaGasto(input, currency), updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function deleteExpense(sb: SupabaseClient, id: string): Promise<void> {
  const { error } = await sb.from("expenses").delete().eq("id", id);
  if (error) throw error;
}

const filaFijo = (input: RecurringInput, currency: string) => ({
  description: input.description,
  amount: input.amount,
  currency,
  frequency: input.frequency,
  next_due: input.nextDue,
  // El día que eligió el usuario manda en los saltos futuros, aunque algún mes se recorte.
  anchor_day: Number(input.nextDue.slice(8, 10)),
  category_id: input.categoryId ?? null,
});

export async function createRecurring(
  sb: SupabaseClient, tenantId: string, userId: string, currency: string, input: RecurringInput,
): Promise<string> {
  const { data, error } = await sb.from("recurring_expenses")
    .insert({ tenant_id: tenantId, created_by: userId, ...filaFijo(input, currency) })
    .select("id").single();
  if (error) throw error;
  return data.id as string;
}

export async function updateRecurring(sb: SupabaseClient, id: string, currency: string, input: RecurringInput): Promise<void> {
  const { error } = await sb.from("recurring_expenses")
    .update({ ...filaFijo(input, currency), updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function setRecurringActive(sb: SupabaseClient, id: string, active: boolean): Promise<void> {
  const { error } = await sb.from("recurring_expenses")
    .update({ active, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function deleteRecurring(sb: SupabaseClient, id: string): Promise<void> {
  const { error } = await sb.from("recurring_expenses").delete().eq("id", id);
  if (error) throw error;
}

export type PagoFijo = { gastoId: string; proximaFecha: string };

/** Registra el pago de un gasto fijo: nace el gasto real y la plantilla avanza.
 *
 *  El orden importa. Primero se guarda el gasto, que es el hecho que no se puede
 *  perder; solo si eso sale bien se mueve la fecha. Al revés, un fallo dejaría la
 *  plantilla apuntando al mes siguiente sin que el pago exista en ninguna parte.
 *
 *  Si el avance falla, el gasto ya guardado se deshace: es preferible repetir el
 *  registro a tener un pago sin su plantilla al día. */
export async function pagarRecurring(
  sb: SupabaseClient, tenantId: string, userId: string, branchId: string | null,
  fijo: { id: string; description: string; amount: number; currency: string; frequency: RecurringInput["frequency"]; nextDue: string; anchorDay: number; categoryId: string | null },
  opts: { spentOn: string; paymentMethod?: string | null },
): Promise<PagoFijo> {
  const { data, error } = await sb.from("expenses").insert({
    tenant_id: tenantId, created_by: userId, branch_id: branchId,
    recurring_id: fijo.id,
    description: fijo.description,
    amount: fijo.amount,
    currency: fijo.currency,
    spent_on: opts.spentOn,
    category_id: fijo.categoryId,
    payment_method: opts.paymentMethod ?? null,
  }).select("id").single();
  if (error) throw error;

  const proximaFecha = siguienteFecha(fijo.nextDue, fijo.frequency, fijo.anchorDay);
  const { error: e2 } = await sb.from("recurring_expenses")
    .update({ next_due: proximaFecha, updated_at: new Date().toISOString() }).eq("id", fijo.id);
  if (e2) {
    await sb.from("expenses").delete().eq("id", data.id);
    throw e2;
  }
  return { gastoId: data.id as string, proximaFecha };
}

export async function createExpenseCategory(sb: SupabaseClient, tenantId: string, name: string) {
  const { data, error } = await sb.from("expense_categories")
    .insert({ tenant_id: tenantId, name }).select("id, name").single();
  if (error) throw error;
  return data as { id: string; name: string };
}

export async function updateExpenseCategory(sb: SupabaseClient, id: string, patch: { name?: string; active?: boolean }) {
  const { error } = await sb.from("expense_categories").update(patch).eq("id", id);
  if (error) throw error;
}
