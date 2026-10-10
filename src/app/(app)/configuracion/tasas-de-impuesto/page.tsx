import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listTaxRates } from "@/lib/productos/queries";
import { canManageTaxRates } from "@/lib/productos/permissions";
import { createTaxRateFormAction, updateTaxRateAction } from "@/app/(app)/operaciones/productos/actions";
import { ModuleHeader } from "@/components/shared/module-header";
import { Page } from "@/components/shared/page";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { SettingsList, SettingsRow, SettingsCreate, SETTINGS_INPUT } from "@/components/configuracion/settings-list";
import type { Role } from "@/lib/auth/roles";

export default async function TasasDeImpuestoPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  const { data: mem } = await sb.from("memberships").select("role").eq("user_id", user!.id).single();
  const role = (mem?.role ?? "vendedor") as Role;
  if (!canManageTaxRates(role)) redirect("/dashboard");

  const rates = await listTaxRates(sb, { includeInactive: true });

  return (
    <Page>
      <ModuleHeader module="config_tasas" />

      <SettingsCreate action={createTaxRateFormAction}>
        <label htmlFor="nueva-tasa" className="sr-only">Nombre de la tasa</label>
        <input id="nueva-tasa" name="name" placeholder="Nombre (ej. IVA 16%)" className={`${SETTINGS_INPUT} min-w-[220px] flex-1`} />
        <label htmlFor="nueva-tasa-pct" className="sr-only">Porcentaje</label>
        <input id="nueva-tasa-pct" name="rate" type="number" step="0.01" min="0" max="100" placeholder="%" className={`${SETTINGS_INPUT} w-24`} />
        <label className="flex items-center gap-1.5 text-sm text-[var(--text-soft)]">
          <input type="checkbox" name="isDefault" value="true" /> Predeterminada
        </label>
        <Button variant="primary" icon="plus">Añadir</Button>
      </SettingsCreate>

      <SettingsList label="Tasa y porcentaje">
        {rates.map((t) => (
          <SettingsRow key={t.id}
            fields={
              <form action={updateTaxRateAction} id={`tasa-${t.id}`} className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                <input type="hidden" name="id" value={t.id} />
                <label htmlFor={`tasa-name-${t.id}`} className="sr-only">Nombre de la tasa</label>
                <input id={`tasa-name-${t.id}`} name="name" defaultValue={t.name} className={`${SETTINGS_INPUT} min-w-0 flex-1`} />
                <label htmlFor={`tasa-pct-${t.id}`} className="sr-only">Porcentaje</label>
                <input id={`tasa-pct-${t.id}`} name="rate" type="number" step="0.01" min="0" max="100" defaultValue={t.rate} className={`${SETTINGS_INPUT} w-24`} />
                {!t.active && <StatusBadge tone="neutral" label="Inactiva" />}
              </form>
            }
            actions={<>
              {t.isDefault
                ? <StatusBadge tone="info" label="Predeterminada" />
                : <button form={`tasa-${t.id}`} name="isDefault" value="true"
                    className="rounded-[10px] border border-[var(--border)] px-2.5 py-2 text-xs text-[var(--text)] transition-colors hover:bg-[var(--bg)]">Hacer predeterminada</button>}
              <Button variant="secondary" form={`tasa-${t.id}`}>Guardar</Button>
              <form action={updateTaxRateAction}>
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
