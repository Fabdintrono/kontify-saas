import { createClient } from "@/lib/supabase/server";
import { listClientTypes } from "@/lib/clientes/queries";
import { createClientAction } from "@/app/(app)/clientes/actions";
import { ClientForm } from "@/components/clientes/client-form";
import { FormHeader } from "@/components/shared/form-shell";
import { Page } from "@/components/shared/page";

export default async function NuevoClientePage() {
  const sb = await createClient();
  const types = await listClientTypes(sb);
  return (
    <Page>
      <FormHeader backHref="/clientes" backLabel="Clientes" title="Nuevo cliente"
        subtitle="Con el nombre basta. Lo demás lo puedes completar cuando lo tengas." />
      <ClientForm action={createClientAction} types={types} submitLabel="Crear cliente" cancelHref="/clientes" />
    </Page>
  );
}
