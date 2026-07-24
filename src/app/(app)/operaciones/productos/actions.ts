"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient as serverSupabase } from "@/lib/supabase/server";
import {
  productCreateSchema, categoryCreateSchema, categoryUpdateSchema,
  taxRateCreateSchema, taxRateUpdateSchema,
} from "@/lib/productos/schema";
import { canManageProducts, canArchiveProduct, canManageCategories, canManageTaxRates } from "@/lib/productos/permissions";
import * as m from "@/lib/productos/mutations";
import type { Role } from "@/lib/auth/roles";

export type FormState = { ok: boolean; error?: string; fieldErrors?: Record<string, string> };
const LIST = "/operaciones/productos";
const CATS = "/configuracion/categorias-de-producto";
const TAXES = "/configuracion/tasas-de-impuesto";

function zodErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of err.issues) { const k = String(i.path[0] ?? "_"); if (!out[k]) out[k] = i.message; }
  return out;
}

const productFields = (fd: FormData) => ({
  kind: fd.get("kind"), name: fd.get("name"), sku: fd.get("sku"), description: fd.get("description"),
  unit: fd.get("unit"), categoryId: fd.get("categoryId"), price: fd.get("price"),
  cost: fd.get("cost"), taxRateId: fd.get("taxRateId"),
});

async function ctx() {
  const sb = await serverSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const { data: mem } = await sb.from("memberships").select("role").eq("user_id", user.id).single();
  const { data: tenantId } = await sb.rpc("current_tenant_id");
  return { sb, userId: user.id, role: (mem?.role ?? "vendedor") as Role, tenantId: tenantId as string };
}

export async function createProductAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { sb, userId, role, tenantId } = await ctx();
  if (!canManageProducts(role)) return { ok: false, error: "Sin permiso" };
  const parsed = productCreateSchema.safeParse(productFields(fd));
  if (!parsed.success) return { ok: false, fieldErrors: zodErrors(parsed.error) };
  let id: string;
  try { id = await m.createProduct(sb, tenantId, userId, null, parsed.data); }
  catch (e) { return { ok: false, error: (e as Error).message }; }
  revalidatePath(LIST);
  redirect(`${LIST}/${id}`);
}

export async function updateProductAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { sb, role } = await ctx();
  if (!canManageProducts(role)) return { ok: false, error: "Sin permiso" };
  const id = String(fd.get("id") ?? "");
  const parsed = productCreateSchema.safeParse(productFields(fd));
  if (!parsed.success) return { ok: false, fieldErrors: zodErrors(parsed.error) };
  try { await m.updateProduct(sb, id, parsed.data); }
  catch (e) { return { ok: false, error: (e as Error).message }; }
  revalidatePath(`${LIST}/${id}`);
  redirect(`${LIST}/${id}`);
}

export async function archiveProductAction(fd: FormData): Promise<void> {
  const { sb, role } = await ctx();
  if (!canArchiveProduct(role)) return; // botón oculto para no-owner/admin; defensa extra
  const id = String(fd.get("id") ?? "");
  const active = fd.get("active") === "true";
  await m.archiveProduct(sb, id, active);
  revalidatePath(LIST);
  revalidatePath(`${LIST}/${id}`);
}

// Crear categoría al vuelo desde el formulario de producto (llamada directa desde client component).
export async function createCategoryNamed(
  name: string,
): Promise<{ ok: boolean; category?: { id: string; name: string }; error?: string }> {
  const { sb, role, tenantId } = await ctx();
  if (!canManageProducts(role)) return { ok: false, error: "Sin permiso" };
  const parsed = categoryCreateSchema.safeParse({ name });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };
  try {
    const c = await m.createCategory(sb, tenantId, parsed.data.name);
    revalidatePath(LIST);
    return { ok: true, category: c };
  } catch (e) { return { ok: false, error: (e as Error).message }; }
}

export async function createCategoryFormAction(fd: FormData): Promise<void> {
  const { sb, role, tenantId } = await ctx();
  if (!canManageCategories(role)) return;
  const parsed = categoryCreateSchema.safeParse({ name: fd.get("name") });
  if (!parsed.success) return;
  try { await m.createCategory(sb, tenantId, parsed.data.name); } catch { return; }
  revalidatePath(CATS);
}

export async function updateCategoryAction(fd: FormData): Promise<void> {
  const { sb, role } = await ctx();
  if (!canManageCategories(role)) return;
  const id = String(fd.get("id") ?? "");
  const patch: { name?: string; active?: boolean } = {};
  if (fd.has("name")) patch.name = String(fd.get("name"));
  if (fd.has("active")) patch.active = fd.get("active") === "true";
  const parsed = categoryUpdateSchema.safeParse(patch);
  if (!parsed.success) return;
  await m.updateCategory(sb, id, parsed.data);
  revalidatePath(CATS);
}

export async function createTaxRateFormAction(fd: FormData): Promise<void> {
  const { sb, role, tenantId } = await ctx();
  if (!canManageTaxRates(role)) return;
  const parsed = taxRateCreateSchema.safeParse({
    name: fd.get("name"), rate: fd.get("rate"), isDefault: fd.get("isDefault") === "true",
  });
  if (!parsed.success) return;
  try { await m.createTaxRate(sb, tenantId, parsed.data); } catch { return; }
  revalidatePath(TAXES);
}

export async function updateTaxRateAction(fd: FormData): Promise<void> {
  const { sb, role, tenantId } = await ctx();
  if (!canManageTaxRates(role)) return;
  const id = String(fd.get("id") ?? "");
  const patch: { name?: string; rate?: number; isDefault?: boolean; active?: boolean } = {};
  if (fd.has("name")) patch.name = String(fd.get("name"));
  if (fd.has("rate")) patch.rate = Number(fd.get("rate"));
  if (fd.has("isDefault")) patch.isDefault = fd.get("isDefault") === "true";
  if (fd.has("active")) patch.active = fd.get("active") === "true";
  const parsed = taxRateUpdateSchema.safeParse(patch);
  if (!parsed.success) return;
  await m.updateTaxRate(sb, tenantId, id, parsed.data);
  revalidatePath(TAXES);
}
