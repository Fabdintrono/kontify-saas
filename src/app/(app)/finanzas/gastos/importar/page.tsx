import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canManageExpenses } from "@/lib/gastos/permissions";
import { ImportWizard } from "@/components/importar/import-wizard";
import { FormHeader } from "@/components/shared/form-shell";
import { Page } from "@/components/shared/page";
import type { Role } from "@/lib/auth/roles";

export default async function ImportarGastosPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  const { data: mem } = await sb.from("memberships").select("role").eq("user_id", user!.id).single();
  if (!canManageExpenses((mem?.role ?? "vendedor") as Role)) redirect("/dashboard");

  return (
    <Page>
      <FormHeader backHref="/finanzas/gastos" backLabel="Gastos" title="Importar gastos"
        subtitle="Trae lo que ya llevabas en una hoja. Verás una vista previa antes de guardar nada." />
      <ImportWizard entidad="gastos" />
    </Page>
  );
}
