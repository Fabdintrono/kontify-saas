"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient as serverSupabase } from "@/lib/supabase/server";
import { paymentCreateSchema, dueDateSchema } from "@/lib/cobros/schema";
import { canRegisterPayment, canVoidPayment, canEditDueDate } from "@/lib/cobros/permissions";
import * as m from "@/lib/cobros/mutations";
import type { Role } from "@/lib/auth/roles";

export type FormState = { ok: boolean; error?: string; fieldErrors?: Record<string, string> };
const CXC = "/finanzas/cuentas-por-cobrar";

function zodErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of err.issues) { const k = String(i.path[0] ?? "_"); if (!out[k]) out[k] = i.message; }
  return out;
}

async function ctx() {
  const sb = await serverSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const { data: mem } = await sb.from("memberships").select("role").eq("user_id", user.id).single();
  const { data: tenantId } = await sb.rpc("current_tenant_id");
  return { sb, userId: user.id, role: (mem?.role ?? "vendedor") as Role, tenantId: tenantId as string };
}

async function revalidateFor(sb: any, saleId: string, clientId?: string | null) {
  revalidatePath(CXC);
  revalidatePath(`/operaciones/facturacion/${saleId}`);
  revalidatePath("/dashboard");
  let cid = clientId;
  if (cid === undefined) {
    const { data } = await sb.from("sales").select("client_id").eq("id", saleId).maybeSingle();
    cid = data?.client_id ?? null;
  }
  if (cid) { revalidatePath(`${CXC}/${cid}`); revalidatePath(`/clientes/${cid}`); }
}

export async function registerPaymentAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { sb, userId, role, tenantId } = await ctx();
  if (!canRegisterPayment(role)) return { ok: false, error: "Sin permiso" };
  const parsed = paymentCreateSchema.safeParse({
    saleId: fd.get("saleId"), amount: fd.get("amount"), method: fd.get("method"),
    reference: fd.get("reference"), paidAt: fd.get("paidAt"), notes: fd.get("notes"),
  });
  if (!parsed.success) return { ok: false, fieldErrors: zodErrors(parsed.error) };
  try { await m.registerPayment(sb, tenantId, userId, parsed.data); }
  catch (e) { return { ok: false, error: (e as Error).message }; }
  await revalidateFor(sb, parsed.data.saleId);
  return { ok: true };
}

export async function voidPaymentAction(fd: FormData): Promise<void> {
  const { sb, role } = await ctx();
  if (!canVoidPayment(role)) return;
  const id = String(fd.get("id") ?? "");
  const saleId = String(fd.get("saleId") ?? "");
  await m.voidPayment(sb, id);
  await revalidateFor(sb, saleId);
}

export async function setDueDateAction(fd: FormData): Promise<void> {
  const { sb, role } = await ctx();
  if (!canEditDueDate(role)) return;
  const parsed = dueDateSchema.safeParse({ saleId: fd.get("saleId"), dueDate: fd.get("dueDate") });
  if (!parsed.success) return;
  await m.setDueDate(sb, parsed.data.saleId, parsed.data.dueDate);
  await revalidateFor(sb, parsed.data.saleId);
}
