import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listExpenseCategories } from "@/lib/gastos/queries";
import { canManageExpenses } from "@/lib/gastos/permissions";
import { getTenantSettings } from "@/lib/tenant";
import { todayISO } from "@/lib/tz";
import { RecurringForm } from "@/components/gastos/recurring-form";
import { FormHeader } from "@/components/shared/form-shell";
import { Page } from "@/components/shared/page";
import { createRecurringAction } from "../../actions";
import type { Role } from "@/lib/auth/roles";

export default async function NuevoFijoPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  const { data: mem } = await sb.from("memberships").select("role").eq("user_id", user!.id).single();
  if (!canManageExpenses((mem?.role ?? "vendedor") as Role)) redirect("/dashboard");

  const [categories, { currency, timezone }] = await Promise.all([
    listExpenseCategories(sb), getTenantSettings(sb),
  ]);
  return (
    <Page>
      <FormHeader backHref="/finanzas/gastos?ver=fijos" backLabel="Gastos fijos" title="Nuevo gasto fijo"
        subtitle="Lo que pagas cada cierto tiempo. Te avisa cuando toca y se registra con un clic." />
      <RecurringForm action={createRecurringAction} categories={categories} currency={currency}
        hoy={todayISO(timezone)} submitLabel="Crear gasto fijo" cancelHref="/finanzas/gastos?ver=fijos" />
    </Page>
  );
}
