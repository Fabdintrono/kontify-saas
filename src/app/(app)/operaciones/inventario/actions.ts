"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient as serverSupabase } from "@/lib/supabase/server";
import { adjustmentSchema } from "@/lib/inventario/schema";
import { canManageStock } from "@/lib/inventario/permissions";
import { registerAdjustment } from "@/lib/inventario/mutations";
import type { Role } from "@/lib/auth/roles";
import { redirect } from "next/navigation";

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
  const { data: mem } = await sb.from("memberships").select("role").eq("user_id", user.id).single();
  const { data: tenantId } = await sb.rpc("current_tenant_id");
  return { sb, userId: user.id, role: (mem?.role ?? "vendedor") as Role, tenantId: tenantId as string };
}

export async function registerAdjustmentAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { sb, userId, role, tenantId } = await ctx();
  if (!canManageStock(role)) return { ok: false, error: "Sin permiso" };
  const parsed = adjustmentSchema.safeParse({
    productId: fd.get("productId"), branchId: fd.get("branchId"),
    direction: fd.get("direction"), quantity: fd.get("quantity"), reason: fd.get("reason"),
  });
  if (!parsed.success) return { ok: false, fieldErrors: zodErrors(parsed.error) };
  try { await registerAdjustment(sb, tenantId, userId, parsed.data); }
  catch (e) { return { ok: false, error: (e as Error).message }; }
  revalidatePath("/operaciones/inventario");
  revalidatePath(`/operaciones/productos/${parsed.data.productId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}
