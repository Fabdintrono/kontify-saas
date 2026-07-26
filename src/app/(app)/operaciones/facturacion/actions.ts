"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient as serverSupabase } from "@/lib/supabase/server";
import { getTenantCurrency } from "@/lib/productos/queries";
import { saleSaveSchema, saleEmitSchema, emitSchema } from "@/lib/ventas/schema";
import { canSell, canVoidSale } from "@/lib/ventas/permissions";
import * as m from "@/lib/ventas/mutations";
import type { Role } from "@/lib/auth/roles";

export type FormState = { ok: boolean; error?: string; fieldErrors?: Record<string, string> };
const LIST = "/operaciones/facturacion";

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

const BACK_OFFICE: Role[] = ["owner", "admin", "administrativo"];

function commonFields(fd: FormData) {
  let items: unknown = [];
  try { items = JSON.parse(String(fd.get("items") ?? "[]")); } catch { items = null; }
  return {
    clientId: fd.get("clientId"),
    branchId: fd.get("branchId"),
    globalDiscountPct: fd.get("globalDiscountPct"),
    notes: fd.get("notes"),
    items,
  };
}

// Acción única con intent (save | emit) para el builder; compatible con useActionState.
export async function submitSaleAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { sb, userId, role, tenantId, branchId } = await ctx();
  if (!canSell(role)) return { ok: false, error: "Sin permiso" };
  const intent = String(fd.get("intent") ?? "save");
  const id = String(fd.get("id") ?? "");

  const schema = intent === "emit" ? saleEmitSchema : saleSaveSchema;
  const parsed = schema.safeParse(commonFields(fd));
  if (!parsed.success) return { ok: false, fieldErrors: zodErrors(parsed.error) };

  // Los operativos solo operan en su sucursal: ignora el branchId recibido y fuérzalo al suyo.
  // (RLS es la barrera dura; esto evita un rechazo silencioso y da la sucursal correcta.)
  if (!BACK_OFFICE.includes(role) && branchId) parsed.data.branchId = branchId;

  let saleId = id;
  try {
    const currency = await getTenantCurrency(sb);
    if (id) await m.updateDraft(sb, id, tenantId, parsed.data);
    else saleId = await m.createDraft(sb, tenantId, userId, currency, parsed.data);

    if (intent === "emit") {
      const pay = emitSchema.safeParse({ paymentType: fd.get("paymentType"), paymentMethod: fd.get("paymentMethod") });
      if (!pay.success) return { ok: false, fieldErrors: zodErrors(pay.error) };
      await m.emitSale(sb, saleId, pay.data);
    }
  } catch (e) { return { ok: false, error: (e as Error).message }; }

  revalidatePath(LIST);
  revalidatePath(`${LIST}/${saleId}`);
  revalidatePath("/dashboard");
  if (parsed.data.clientId) revalidatePath(`/clientes/${parsed.data.clientId}`);
  redirect(`${LIST}/${saleId}`);
}

export async function deleteDraftAction(fd: FormData): Promise<void> {
  const { sb, role } = await ctx();
  if (!canSell(role)) return;
  const id = String(fd.get("id") ?? "");
  await m.deleteDraft(sb, id);
  revalidatePath(LIST);
  redirect(LIST);
}

export async function voidSaleAction(fd: FormData): Promise<void> {
  const { sb, role } = await ctx();
  if (!canVoidSale(role)) return; // botón oculto; defensa extra
  const id = String(fd.get("id") ?? "");
  const clientId = String(fd.get("clientId") ?? "");
  await m.voidSale(sb, id);
  revalidatePath(LIST);
  revalidatePath(`${LIST}/${id}`);
  revalidatePath("/dashboard");
  if (clientId) revalidatePath(`/clientes/${clientId}`);
}
