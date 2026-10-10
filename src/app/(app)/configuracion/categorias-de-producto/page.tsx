import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listCategories } from "@/lib/productos/queries";
import { canManageCategories } from "@/lib/productos/permissions";
import { createCategoryFormAction, updateCategoryAction } from "@/app/(app)/operaciones/productos/actions";
import { ModuleHeader } from "@/components/shared/module-header";
import { Page } from "@/components/shared/page";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { SettingsList, SettingsRow, SettingsCreate, SETTINGS_INPUT } from "@/components/configuracion/settings-list";
import type { Role } from "@/lib/auth/roles";

export default async function CategoriasDeProductoPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  const { data: mem } = await sb.from("memberships").select("role").eq("user_id", user!.id).single();
  const role = (mem?.role ?? "vendedor") as Role;
  if (!canManageCategories(role)) redirect("/dashboard");

  const categories = await listCategories(sb, { includeInactive: true });

  return (
    <Page>
      <ModuleHeader module="config_categorias" />

      <SettingsCreate action={createCategoryFormAction}>
        <label htmlFor="nueva-categoria" className="sr-only">Nueva categoría</label>
        <input id="nueva-categoria" name="name" placeholder="Nueva categoría (ej. Repuestos)" className={`${SETTINGS_INPUT} min-w-[220px] flex-1`} />
        <Button variant="primary" icon="plus">Añadir</Button>
      </SettingsCreate>

      <SettingsList label="Categoría">
        {categories.map((c) => (
          <SettingsRow key={c.id}
            fields={
              <form action={updateCategoryAction} id={`cat-${c.id}`} className="flex min-w-0 flex-1 items-center gap-2">
                <input type="hidden" name="id" value={c.id} />
                <label htmlFor={`cat-name-${c.id}`} className="sr-only">Nombre de la categoría</label>
                <input id={`cat-name-${c.id}`} name="name" defaultValue={c.name} className={`${SETTINGS_INPUT} min-w-0 flex-1`} />
                {!c.active && <StatusBadge tone="neutral" label="Inactiva" />}
              </form>
            }
            actions={<>
              <Button variant="secondary" form={`cat-${c.id}`}>Guardar</Button>
              <form action={updateCategoryAction}>
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
