import { createClient } from "@/lib/supabase/server";
import { listClientTypes } from "@/lib/clientes/queries";
import { createClientAction } from "@/app/(app)/clientes/actions";
import { ClientForm } from "@/components/clientes/client-form";

export default async function NuevoClientePage() {
  const sb = await createClient();
  const types = await listClientTypes(sb);
  return (
    <div className="p-6">
      <h1 className="mb-4 text-xl font-extrabold tracking-[-0.4px] text-[var(--text)]">Nuevo cliente</h1>
      <ClientForm action={createClientAction} types={types} submitLabel="Crear cliente" />
    </div>
  );
}
