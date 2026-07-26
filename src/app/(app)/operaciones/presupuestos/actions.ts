"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient as serverSupabase } from "@/lib/supabase/server";
import { getTenantCurrency } from "@/lib/productos/queries";
import { quoteSaveSchema, quoteSendSchema, quoteStatusSchema } from "@/lib/presupuestos/schema";
import { canSell } from "@/lib/ventas/permissions";
import * as m from "@/lib/presupuestos/mutations";
import type { Role } from "@/lib/auth/roles";

export type FormState = { ok: boolean; error?: string; fieldErrors?: Record<string, string> };
const LIST = "/operaciones/presupuestos";
const BACK_OFFICE: Role[] = ["owner", "admin", "administrativo"];

function zodErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of err.issues) { const k = String(i.path.join(".") || "_"); if (!out[k]) out[k] = i.message; }
  return out;
}

async function ctx() {
  const sb = await serverSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const { data: mem } = await sb.from("memberships").select("role, branch_id").eq("user_id", user.id).single();
  const { data: tenantId } = await sb.rpc("current_tenant_id");
  return {
    sb, userId: user.id, role: (mem?.role ?? "vendedor") as Role, tenantId: tenantId as string,
    branchId: (mem?.branch_id ?? null) as string | null,
  };
}

function commonFields(fd: FormData) {
  let items: unknown = [];
  try { items = JSON.parse(String(fd.get("items") ?? "[]")); } catch { items = null; }
  return {
    clientId: fd.get("clientId"), branchId: fd.get("branchId"),
    globalDiscountPct: fd.get("globalDiscountPct"), validUntil: fd.get("validUntil"),
    notes: fd.get("notes"), items,
  };
}

export async function submitQuoteAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { sb, userId, role, tenantId, branchId } = await ctx();
  if (!canSell(role)) return { ok: false, error: "Sin permiso" };
  const intent = String(fd.get("intent") ?? "save");
  const id = String(fd.get("id") ?? "");

  const schema = intent === "send" ? quoteSendSchema : quoteSaveSchema;
  const parsed = schema.safeParse(commonFields(fd));
  if (!parsed.success) return { ok: false, fieldErrors: zodErrors(parsed.error) };
  if (!BACK_OFFICE.includes(role) && branchId) parsed.data.branchId = branchId;

  let quoteId = id;
  try {
    const currency = await getTenantCurrency(sb);
    if (id) await m.updateDraft(sb, id, tenantId, parsed.data);
    else quoteId = await m.createDraft(sb, tenantId, userId, currency, parsed.data);
    if (intent === "send") await m.sendQuote(sb, quoteId);
  } catch (e) { return { ok: false, error: (e as Error).message }; }

  revalidatePath(LIST);
  revalidatePath(`${LIST}/${quoteId}`);
  redirect(`${LIST}/${quoteId}`);
}

export async function deleteQuoteAction(fd: FormData): Promise<void> {
  const { sb, role } = await ctx();
  if (!canSell(role)) return;
  const id = String(fd.get("id") ?? "");
  await m.deleteDraft(sb, id);
  revalidatePath(LIST);
  redirect(LIST);
}

export async function setQuoteStatusAction(fd: FormData): Promise<void> {
  const { sb, role } = await ctx();
  if (!canSell(role)) return;
  const id = String(fd.get("id") ?? "");
  const parsed = quoteStatusSchema.safeParse({ status: fd.get("status") });
  if (!parsed.success) return;
  await m.setQuoteStatus(sb, id, parsed.data.status);
  revalidatePath(LIST);
  revalidatePath(`${LIST}/${id}`);
}

export async function convertQuoteAction(fd: FormData): Promise<void> {
  const { sb, userId, role, tenantId } = await ctx();
  if (!canSell(role)) return;
  const id = String(fd.get("id") ?? "");
  const currency = await getTenantCurrency(sb);
  const saleId = await m.convertToSale(sb, tenantId, userId, currency, id);
  revalidatePath(LIST);
  revalidatePath(`${LIST}/${id}`);
  revalidatePath("/operaciones/facturacion");
  redirect(`/operaciones/facturacion/${saleId}/editar`);
}
