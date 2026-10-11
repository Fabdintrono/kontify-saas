import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getRecurring, listExpenseCategories } from "@/lib/gastos/queries";
import { canManageExpenses } from "@/lib/gastos/permissions";
import { getTenantSettings } from "@/lib/tenant";
import { todayISO } from "@/lib/tz";
import { RecurringForm } from "@/components/gastos/recurring-form";
import { FormHeader } from "@/components/shared/form-shell";
import { Page } from "@/components/shared/page";
import { updateRecurringAction } from "../../../actions";
import type { Role } from "@/lib/auth/roles";

export default async function EditarFijoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  const { data: mem } = await sb.from("memberships").select("role").eq("user_id", user!.id).single();
  if (!canManageExpenses((mem?.role ?? "vendedor") as Role)) redirect("/dashboard");

  const [fijo, categories, { currency, timezone }] = await Promise.all([
    getRecurring(sb, id), listExpenseCategories(sb), getTenantSettings(sb),
  ]);
  if (!fijo) notFound();

  return (
    <Page>
      <FormHeader backHref="/finanzas/gastos?ver=fijos" backLabel="Gastos fijos" title="Editar gasto fijo"
        subtitle="Cambiar el monto afecta a los pagos que registres desde ahora; los anteriores no se tocan." />
      <RecurringForm action={updateRecurringAction} categories={categories} currency={currency}
        hoy={todayISO(timezone)} submitLabel="Guardar cambios" cancelHref="/finanzas/gastos?ver=fijos"
        values={{
          id: fijo.id, description: fijo.description, amount: String(fijo.amount),
          frequency: fijo.frequency, nextDue: fijo.nextDue, categoryId: fijo.categoryId ?? "",
        }} />
    </Page>
  );
}
