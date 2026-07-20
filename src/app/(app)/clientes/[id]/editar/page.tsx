import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getClient, listClientTypes } from "@/lib/clientes/queries";
import { updateClientAction } from "@/app/(app)/clientes/actions";
import { ClientForm } from "@/components/clientes/client-form";

export default async function EditarClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createClient();
  const [c, types] = await Promise.all([getClient(sb, id), listClientTypes(sb)]);
  if (!c) notFound();
  return (
    <div className="p-6">
      <h1 className="mb-4 text-xl font-extrabold tracking-[-0.4px] text-[var(--text)]">Editar cliente</h1>
      <ClientForm action={updateClientAction} types={types} submitLabel="Guardar cambios"
        values={{ id: c.id, kind: c.kind, name: c.name, docId: c.doc_id ?? "", email: c.email ?? "",
          phone: c.phone ?? "", address: c.address ?? "", contactName: c.contact_name ?? "",
          typeId: c.type_id ?? "", notes: c.notes ?? "" }} />
    </div>
  );
}
