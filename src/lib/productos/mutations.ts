import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProductInput, TaxRateInput } from "@/lib/productos/schema";

const productRow = (input: ProductInput) => ({
  kind: input.kind,
  name: input.name,
  sku: input.sku ?? null,
  description: input.description ?? null,
  category_id: input.categoryId ?? null,
  price: input.price,
  cost: input.cost ?? null,
  tax_rate_id: input.taxRateId ?? null,
  unit: input.unit,
});

export async function createProduct(
  sb: SupabaseClient, tenantId: string, userId: string, branchId: string | null, input: ProductInput,
): Promise<string> {
  const { data, error } = await sb.from("products")
    .insert({ tenant_id: tenantId, created_by: userId, created_branch_id: branchId, ...productRow(input) })
    .select("id").single();
  if (error) throw error;
  return data.id as string;
}

export async function updateProduct(sb: SupabaseClient, id: string, input: ProductInput): Promise<void> {
  const { error } = await sb.from("products")
    .update({ ...productRow(input), updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function archiveProduct(sb: SupabaseClient, id: string, active: boolean): Promise<void> {
  const { error } = await sb.from("products")
    .update({ active, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function createCategory(sb: SupabaseClient, tenantId: string, name: string) {
  const { data, error } = await sb.from("product_categories")
    .insert({ tenant_id: tenantId, name }).select("id, name").single();
  if (error) throw error;
  return data as { id: string; name: string };
}

export async function updateCategory(sb: SupabaseClient, id: string, patch: { name?: string; active?: boolean }) {
  const { error } = await sb.from("product_categories").update(patch).eq("id", id);
  if (error) throw error;
}

// Mantiene a-lo-sumo-un-default por tenant: si esta tasa es default, desmarca las demás primero.
export async function createTaxRate(sb: SupabaseClient, tenantId: string, input: TaxRateInput) {
  if (input.isDefault) await sb.from("tax_rates").update({ is_default: false }).eq("tenant_id", tenantId);
  const { data, error } = await sb.from("tax_rates")
    .insert({ tenant_id: tenantId, name: input.name, rate: input.rate, is_default: input.isDefault ?? false })
    .select("id, name").single();
  if (error) throw error;
  return data as { id: string; name: string };
}

export async function updateTaxRate(
  sb: SupabaseClient, tenantId: string, id: string,
  patch: { name?: string; rate?: number; isDefault?: boolean; active?: boolean },
) {
  if (patch.isDefault) await sb.from("tax_rates").update({ is_default: false }).eq("tenant_id", tenantId);
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.rate !== undefined) row.rate = patch.rate;
  if (patch.isDefault !== undefined) row.is_default = patch.isDefault;
  if (patch.active !== undefined) row.active = patch.active;
  const { error } = await sb.from("tax_rates").update(row).eq("id", id);
  if (error) throw error;
}
