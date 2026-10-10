import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getClient, listClientTypes } from "@/lib/clientes/queries";
import { updateClientAction } from "@/app/(app)/clientes/actions";
import { ClientForm } from "@/components/clientes/client-form";
import { FormHeader } from "@/components/shared/form-shell";
import { Page } from "@/components/shared/page";

export default async function EditarClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createClient();
  const [c, types] = await Promise.all([getClient(sb, id), listClientTypes(sb)]);
  if (!c) notFound();
  return (
    <Page>
      <FormHeader backHref={`/clientes/${c.id}`} backLabel={c.name} title="Editar cliente"
        subtitle="Los cambios se ven de inmediato en las listas y en las ventas futuras." />
      <ClientForm action={updateClientAction} types={types} submitLabel="Guardar cambios" cancelHref={`/clientes/${c.id}`}
        values={{ id: c.id, kind: c.kind, name: c.name, docId: c.doc_id ?? "", email: c.email ?? "",
          phone: c.phone ?? "", address: c.address ?? "", contactName: c.contact_name ?? "",
          typeId: c.type_id ?? "", notes: c.notes ?? "" }} />
    </Page>
  );
}
