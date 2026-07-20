import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClientInput } from "@/lib/clientes/schema";

const clientRow = (input: ClientInput) => ({
  kind: input.kind,
  name: input.name,
  doc_id: input.docId ?? null,
  email: input.email ?? null,
  phone: input.phone ?? null,
  address: input.address ?? null,
  contact_name: input.contactName ?? null,
  type_id: input.typeId ?? null,
  notes: input.notes ?? null,
});

export async function createClient(
  sb: SupabaseClient, tenantId: string, userId: string, branchId: string | null, input: ClientInput,
): Promise<string> {
  const { data, error } = await sb.from("clients")
    .insert({ tenant_id: tenantId, created_by: userId, created_branch_id: branchId, ...clientRow(input) })
    .select("id").single();
  if (error) throw error;
  return data.id as string;
}

export async function updateClient(sb: SupabaseClient, id: string, input: ClientInput): Promise<void> {
  const { error } = await sb.from("clients")
    .update({ ...clientRow(input), updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function archiveClient(sb: SupabaseClient, id: string, active: boolean): Promise<void> {
  const { error } = await sb.from("clients")
    .update({ active, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function createClientType(sb: SupabaseClient, tenantId: string, name: string) {
  const { data, error } = await sb.from("client_types")
    .insert({ tenant_id: tenantId, name }).select("id, name").single();
  if (error) throw error;
  return data as { id: string; name: string };
}

export async function updateClientType(sb: SupabaseClient, id: string, patch: { name?: string; active?: boolean }) {
  const { error } = await sb.from("client_types").update(patch).eq("id", id);
  if (error) throw error;
}
