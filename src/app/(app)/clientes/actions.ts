"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient as serverSupabase } from "@/lib/supabase/server";
import { clientCreateSchema, clientTypeCreateSchema, clientTypeUpdateSchema } from "@/lib/clientes/schema";
import { canArchiveClient, canManageClientTypes } from "@/lib/clientes/permissions";
import * as m from "@/lib/clientes/mutations";
import type { Role } from "@/lib/auth/roles";

export type FormState = { ok: boolean; error?: string; fieldErrors?: Record<string, string> };

function zodErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of err.issues) { const k = String(i.path[0] ?? "_"); if (!out[k]) out[k] = i.message; }
  return out;
}

const clientFields = (fd: FormData) => ({
  kind: fd.get("kind"), name: fd.get("name"), docId: fd.get("docId"), email: fd.get("email"),
  phone: fd.get("phone"), address: fd.get("address"), contactName: fd.get("contactName"),
  typeId: fd.get("typeId"), notes: fd.get("notes"),
});

async function ctx() {
  const sb = await serverSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const { data: mem } = await sb.from("memberships").select("role").eq("user_id", user.id).single();
  const { data: tenantId } = await sb.rpc("current_tenant_id");
  return { sb, userId: user.id, role: (mem?.role ?? "vendedor") as Role, tenantId: tenantId as string };
}

export async function createClientAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { sb, userId, tenantId } = await ctx();
  const parsed = clientCreateSchema.safeParse(clientFields(fd));
  if (!parsed.success) return { ok: false, fieldErrors: zodErrors(parsed.error) };
  let id: string;
  try { id = await m.createClient(sb, tenantId, userId, null, parsed.data); }
  catch (e) { return { ok: false, error: (e as Error).message }; }
  revalidatePath("/clientes");
  redirect(`/clientes/${id}`);
}

export async function updateClientAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { sb } = await ctx();
  const id = String(fd.get("id") ?? "");
  const parsed = clientCreateSchema.safeParse(clientFields(fd));
  if (!parsed.success) return { ok: false, fieldErrors: zodErrors(parsed.error) };
  try { await m.updateClient(sb, id, parsed.data); }
  catch (e) { return { ok: false, error: (e as Error).message }; }
  revalidatePath(`/clientes/${id}`);
  redirect(`/clientes/${id}`);
}

export async function archiveClientAction(fd: FormData): Promise<void> {
  const { sb, role } = await ctx();
  if (!canArchiveClient(role)) return; // el botón no se muestra a vendedor; defensa extra
  const id = String(fd.get("id") ?? "");
  const active = fd.get("active") === "true";
  await m.archiveClient(sb, id, active);
  revalidatePath("/clientes");
  revalidatePath(`/clientes/${id}`);
}

// Variante para <form action=...> de la pantalla de gestión (firma de form-action, sin estado de retorno).
export async function createClientTypeFormAction(fd: FormData): Promise<void> {
  const { sb, tenantId } = await ctx();
  const parsed = clientTypeCreateSchema.safeParse({ name: fd.get("name") });
  if (!parsed.success) return;
  try { await m.createClientType(sb, tenantId, parsed.data.name); } catch { return; }
  revalidatePath("/configuracion/tipos-de-cliente");
}

// Variante llamable DIRECTAMENTE desde un client component (crear tipo al vuelo en el formulario de cliente).
export async function createClientTypeNamed(
  name: string,
): Promise<{ ok: boolean; type?: { id: string; name: string }; error?: string }> {
  const { sb, tenantId } = await ctx();
  const parsed = clientTypeCreateSchema.safeParse({ name });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };
  try {
    const t = await m.createClientType(sb, tenantId, parsed.data.name);
    revalidatePath("/clientes");
    return { ok: true, type: t };
  } catch (e) { return { ok: false, error: (e as Error).message }; }
}

export async function updateClientTypeAction(fd: FormData): Promise<void> {
  const { sb, role } = await ctx();
  if (!canManageClientTypes(role)) return;
  const id = String(fd.get("id") ?? "");
  const patch: { name?: string; active?: boolean } = {};
  if (fd.has("name")) patch.name = String(fd.get("name"));
  if (fd.has("active")) patch.active = fd.get("active") === "true";
  const parsed = clientTypeUpdateSchema.safeParse(patch);
  if (!parsed.success) return;
  await m.updateClientType(sb, id, parsed.data);
  revalidatePath("/configuracion/tipos-de-cliente");
}
