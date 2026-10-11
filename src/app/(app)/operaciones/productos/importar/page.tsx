import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canManageProducts } from "@/lib/productos/permissions";
import { ImportWizard } from "@/components/importar/import-wizard";
import { FormHeader } from "@/components/shared/form-shell";
import { Page } from "@/components/shared/page";
import type { Role } from "@/lib/auth/roles";

export default async function ImportarProductosPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  const { data: mem } = await sb.from("memberships").select("role").eq("user_id", user!.id).single();
  if (!canManageProducts((mem?.role ?? "vendedor") as Role)) redirect("/operaciones/productos");

  return (
    <Page>
      <FormHeader backHref="/operaciones/productos" backLabel="Productos" title="Importar productos"
        subtitle="Trae tu catálogo desde Excel o desde un CSV. Verás una vista previa antes de guardar nada." />
      <ImportWizard entidad="productos" />
    </Page>
  );
}
