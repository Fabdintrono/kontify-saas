"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { actionError, type ActionResult } from "@/lib/action-result";
import type { Role } from "@/lib/auth/roles";

/** Oculta «Primeros pasos» para toda la empresa (solo dueño/admin). */
export async function hideGettingStartedAction(_fd: FormData): Promise<ActionResult> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const { data: mem } = await sb.from("memberships").select("role").eq("user_id", user.id).single();
  const role = (mem?.role ?? "vendedor") as Role;
  if (!["owner", "admin"].includes(role)) return { error: "No tienes permiso para esta acción." };
  const { data: tid } = await sb.rpc("current_tenant_id");
  try {
    const { error } = await sb.from("tenants").update({ getting_started_hidden: true }).eq("id", tid as string);
    if (error) throw error;
  } catch (e) { return actionError(e); }
  revalidatePath("/dashboard");
}
