import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listClientTypes } from "@/lib/clientes/queries";
import { canManageClientTypes } from "@/lib/clientes/permissions";
import { createClientTypeFormAction, updateClientTypeAction } from "@/app/(app)/clientes/actions";
import { ModuleHeader } from "@/components/shared/module-header";
import { Page } from "@/components/shared/page";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { SettingsList, SettingsRow, SettingsCreate, SETTINGS_INPUT } from "@/components/configuracion/settings-list";
import type { Role } from "@/lib/auth/roles";

export default async function TiposDeClientePage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  const { data: mem } = await sb.from("memberships").select("role").eq("user_id", user!.id).single();
  const role = (mem?.role ?? "vendedor") as Role;
  if (!canManageClientTypes(role)) redirect("/dashboard");

  const types = await listClientTypes(sb, { includeInactive: true });

  return (
    <Page>
      <ModuleHeader module="config_tipos_cliente" />

      <SettingsCreate action={createClientTypeFormAction}>
        <label htmlFor="nuevo-tipo" className="sr-only">Nuevo tipo de cliente</label>
        <input id="nuevo-tipo" name="name" placeholder="Nuevo tipo (ej. Mayorista)" className={`${SETTINGS_INPUT} min-w-[220px] flex-1`} />
        <Button variant="primary" icon="plus">Añadir</Button>
      </SettingsCreate>

      <SettingsList head={<><span className="flex-1">Tipo de cliente</span><span>Acciones</span></>}>
        {types.map((t) => (
          <SettingsRow key={t.id}
            fields={
              <form action={updateClientTypeAction} id={`tipo-${t.id}`} className="flex min-w-0 flex-1 items-center gap-2">
                <input type="hidden" name="id" value={t.id} />
                <label htmlFor={`tipo-name-${t.id}`} className="sr-only">Nombre del tipo</label>
                <input id={`tipo-name-${t.id}`} name="name" defaultValue={t.name} className={`${SETTINGS_INPUT} min-w-0 flex-1`} />
                {!t.active && <StatusBadge tone="neutral" label="Inactivo" />}
              </form>
            }
            actions={<>
              <Button variant="secondary" form={`tipo-${t.id}`}>Guardar</Button>
              <form action={updateClientTypeAction}>
                <input type="hidden" name="id" value={t.id} />
                <input type="hidden" name="active" value={t.active ? "false" : "true"} />
                <Button variant="secondary">{t.active ? "Desactivar" : "Activar"}</Button>
              </form>
            </>} />
        ))}
      </SettingsList>
    </Page>
  );
}
