"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient as serverSupabase } from "@/lib/supabase/server";
import {
  expenseCreateSchema, recurringCreateSchema, expenseCategorySchema,
} from "@/lib/gastos/schema";
import { canManageExpenses, canDeleteExpense, canManageExpenseCategories } from "@/lib/gastos/permissions";
import { getRecurring } from "@/lib/gastos/queries";
import * as m from "@/lib/gastos/mutations";
import { getTenantSettings } from "@/lib/tenant";
import { todayISO } from "@/lib/tz";
import { withFlash } from "@/lib/flash";
import { actionError, type ActionResult } from "@/lib/action-result";
import type { Role } from "@/lib/auth/roles";

export type FormState = { ok: boolean; error?: string; fieldErrors?: Record<string, string> };

function zodErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of err.issues) { const k = String(i.path[0] ?? "_"); if (!out[k]) out[k] = i.message; }
  return out;
}

async function ctx() {
  const sb = await serverSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const { data: mem } = await sb.from("memberships").select("role, branch_id").eq("user_id", user.id).single();
  const { data: tenantId } = await sb.rpc("current_tenant_id");
  const { currency, timezone } = await getTenantSettings(sb);
  return {
    sb, userId: user.id, branchId: (mem?.branch_id ?? null) as string | null,
    role: (mem?.role ?? "vendedor") as Role, tenantId: tenantId as string, currency, timezone,
  };
}

const RUTA = "/finanzas/gastos";
function revalidar() {
  revalidatePath(RUTA);
  revalidatePath("/dashboard");
  revalidatePath("/reportes/ventas");
}

const campos = (fd: FormData) => ({
  description: fd.get("description"), amount: fd.get("amount"), spentOn: fd.get("spentOn"),
  categoryId: fd.get("categoryId"), paymentMethod: fd.get("paymentMethod"),
  supplier: fd.get("supplier"), notes: fd.get("notes"),
});

export async function createExpenseAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { sb, userId, branchId, tenantId, currency, role } = await ctx();
  if (!canManageExpenses(role)) return { ok: false, error: "Tu rol no lleva los gastos." };
  const parsed = expenseCreateSchema.safeParse(campos(fd));
  if (!parsed.success) return { ok: false, fieldErrors: zodErrors(parsed.error) };
  try { await m.createExpense(sb, tenantId, userId, branchId, currency, parsed.data); }
  catch (e) { return { ok: false, ...actionError(e) }; }
  revalidar();
  redirect(withFlash(RUTA, "gasto-registrado"));
}

export async function updateExpenseAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { sb, currency, role } = await ctx();
  if (!canManageExpenses(role)) return { ok: false, error: "Tu rol no lleva los gastos." };
  const id = String(fd.get("id") ?? "");
  const parsed = expenseCreateSchema.safeParse(campos(fd));
  if (!parsed.success) return { ok: false, fieldErrors: zodErrors(parsed.error) };
  try { await m.updateExpense(sb, id, currency, parsed.data); }
  catch (e) { return { ok: false, ...actionError(e) }; }
  revalidar();
  redirect(withFlash(RUTA, "gasto-guardado"));
}

export async function deleteExpenseAction(fd: FormData): Promise<ActionResult> {
  const { sb, role } = await ctx();
  if (!canDeleteExpense(role)) return { error: "No tienes permiso para borrar gastos." };
  try { await m.deleteExpense(sb, String(fd.get("id") ?? "")); }
  catch (e) { return actionError(e); }
  revalidar();
}

const camposFijo = (fd: FormData) => ({
  description: fd.get("description"), amount: fd.get("amount"),
  frequency: fd.get("frequency"), nextDue: fd.get("nextDue"), categoryId: fd.get("categoryId"),
});

export async function createRecurringAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { sb, userId, tenantId, currency, role } = await ctx();
  if (!canManageExpenses(role)) return { ok: false, error: "Tu rol no lleva los gastos." };
  const parsed = recurringCreateSchema.safeParse(camposFijo(fd));
  if (!parsed.success) return { ok: false, fieldErrors: zodErrors(parsed.error) };
  try { await m.createRecurring(sb, tenantId, userId, currency, parsed.data); }
  catch (e) { return { ok: false, ...actionError(e) }; }
  revalidar();
  redirect(withFlash(`${RUTA}?ver=fijos`, "fijo-creado"));
}

export async function updateRecurringAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { sb, currency, role } = await ctx();
  if (!canManageExpenses(role)) return { ok: false, error: "Tu rol no lleva los gastos." };
  const id = String(fd.get("id") ?? "");
  const parsed = recurringCreateSchema.safeParse(camposFijo(fd));
  if (!parsed.success) return { ok: false, fieldErrors: zodErrors(parsed.error) };
  try { await m.updateRecurring(sb, id, currency, parsed.data); }
  catch (e) { return { ok: false, ...actionError(e) }; }
  revalidar();
  redirect(withFlash(`${RUTA}?ver=fijos`, "fijo-guardado"));
}

/** Registra el pago de un gasto fijo del día de hoy y mueve la plantilla. */
export async function payRecurringAction(fd: FormData): Promise<ActionResult> {
  const { sb, userId, branchId, tenantId, role, timezone } = await ctx();
  if (!canManageExpenses(role)) return { error: "Tu rol no lleva los gastos." };
  const id = String(fd.get("id") ?? "");
  try {
    const fijo = await getRecurring(sb, id);
    if (!fijo) return { error: "Ese gasto fijo ya no existe." };
    // Se paga con la fecha del vencimiento cuando ya pasó, y con la de hoy si se
    // adelanta: así el gasto cae en el mes al que corresponde.
    const hoy = todayISO(timezone);
    const spentOn = fijo.nextDue < hoy ? fijo.nextDue : hoy;
    await m.pagarRecurring(sb, tenantId, userId, branchId, fijo, { spentOn });
  } catch (e) { return actionError(e); }
  revalidar();
}

export async function setRecurringActiveAction(fd: FormData): Promise<ActionResult> {
  const { sb, role } = await ctx();
  if (!canManageExpenses(role)) return { error: "Tu rol no lleva los gastos." };
  try { await m.setRecurringActive(sb, String(fd.get("id") ?? ""), fd.get("active") === "true"); }
  catch (e) { return actionError(e); }
  revalidar();
}

export async function deleteRecurringAction(fd: FormData): Promise<ActionResult> {
  const { sb, role } = await ctx();
  if (!canDeleteExpense(role)) return { error: "No tienes permiso para borrar gastos fijos." };
  try { await m.deleteRecurring(sb, String(fd.get("id") ?? "")); }
  catch (e) { return actionError(e); }
  revalidar();
}

export async function createExpenseCategoryFormAction(fd: FormData): Promise<void> {
  const { sb, tenantId, role } = await ctx();
  if (!canManageExpenses(role)) return;
  const parsed = expenseCategorySchema.safeParse({ name: fd.get("name") });
  if (!parsed.success) return;
  try { await m.createExpenseCategory(sb, tenantId, parsed.data.name); } catch { return; }
  revalidatePath("/configuracion/categorias-de-gasto");
  revalidatePath(RUTA);
}

export async function updateExpenseCategoryAction(fd: FormData): Promise<void> {
  const { sb, role } = await ctx();
  if (!canManageExpenseCategories(role)) return;
  const id = String(fd.get("id") ?? "");
  const patch: { name?: string; active?: boolean } = {};
  if (fd.has("name")) {
    const parsed = expenseCategorySchema.safeParse({ name: fd.get("name") });
    if (!parsed.success) return;
    patch.name = parsed.data.name;
  }
  if (fd.has("active")) patch.active = fd.get("active") === "true";
  try { await m.updateExpenseCategory(sb, id, patch); } catch { return; }
  revalidatePath("/configuracion/categorias-de-gasto");
  revalidatePath(RUTA);
}

/** Crear una categoría desde el propio formulario de gasto, sin salir de la pantalla. */
export async function createExpenseCategoryNamed(
  name: string,
): Promise<{ ok: boolean; category?: { id: string; name: string }; error?: string }> {
  const { sb, tenantId, role } = await ctx();
  if (!canManageExpenses(role)) return { ok: false, error: "Tu rol no lleva los gastos." };
  const parsed = expenseCategorySchema.safeParse({ name });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };
  try {
    const c = await m.createExpenseCategory(sb, tenantId, parsed.data.name);
    revalidatePath(RUTA);
    return { ok: true, category: c };
  } catch (e) { return { ok: false, ...actionError(e) }; }
}
