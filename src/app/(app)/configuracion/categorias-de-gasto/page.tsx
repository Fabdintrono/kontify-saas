import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listExpenseCategories } from "@/lib/gastos/queries";
import { canManageExpenseCategories } from "@/lib/gastos/permissions";
import { createExpenseCategoryFormAction, updateExpenseCategoryAction } from "@/app/(app)/finanzas/gastos/actions";
import { ModuleHeader } from "@/components/shared/module-header";
import { Page } from "@/components/shared/page";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { SettingsList, SettingsRow, SettingsCreate, SETTINGS_INPUT } from "@/components/configuracion/settings-list";
import type { Role } from "@/lib/auth/roles";

export default async function CategoriasDeGastoPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  const { data: mem } = await sb.from("memberships").select("role").eq("user_id", user!.id).single();
  const role = (mem?.role ?? "vendedor") as Role;
  if (!canManageExpenseCategories(role)) redirect("/dashboard");

  const categorias = await listExpenseCategories(sb, { includeInactive: true });

  return (
    <Page>
      <ModuleHeader module="config_categorias_gasto" />

      <SettingsCreate action={createExpenseCategoryFormAction}>
        <label htmlFor="nueva-categoria-gasto" className="sr-only">Nueva categoría de gasto</label>
        <input id="nueva-categoria-gasto" name="name" placeholder="Nueva categoría (ej. Publicidad)"
          className={`${SETTINGS_INPUT} min-w-[220px] flex-1`} />
        <Button variant="primary" icon="plus">Añadir</Button>
      </SettingsCreate>

      <SettingsList label="Categoría de gasto">
        {categorias.map((c) => (
          <SettingsRow key={c.id}
            fields={
              <form action={updateExpenseCategoryAction} id={`catg-${c.id}`} className="flex min-w-0 flex-1 items-center gap-2">
                <input type="hidden" name="id" value={c.id} />
                <label htmlFor={`catg-name-${c.id}`} className="sr-only">Nombre de la categoría</label>
                <input id={`catg-name-${c.id}`} name="name" defaultValue={c.name} className={`${SETTINGS_INPUT} min-w-0 flex-1`} />
                {!c.active && <StatusBadge tone="neutral" label="Inactiva" />}
              </form>
            }
            actions={<>
              <Button variant="secondary" form={`catg-${c.id}`}>Guardar</Button>
              <form action={updateExpenseCategoryAction}>
                <input type="hidden" name="id" value={c.id} />
                <input type="hidden" name="active" value={c.active ? "false" : "true"} />
                <Button variant="secondary">{c.active ? "Desactivar" : "Activar"}</Button>
              </form>
            </>} />
        ))}
      </SettingsList>
    </Page>
  );
}
