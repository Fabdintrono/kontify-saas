import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listExpenseCategories } from "@/lib/gastos/queries";
import { canManageExpenses } from "@/lib/gastos/permissions";
import { getTenantSettings } from "@/lib/tenant";
import { todayISO } from "@/lib/tz";
import { ExpenseForm } from "@/components/gastos/expense-form";
import { FormHeader } from "@/components/shared/form-shell";
import { Page } from "@/components/shared/page";
import { createExpenseAction } from "../actions";
import type { Role } from "@/lib/auth/roles";

export default async function NuevoGastoPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  const { data: mem } = await sb.from("memberships").select("role").eq("user_id", user!.id).single();
  if (!canManageExpenses((mem?.role ?? "vendedor") as Role)) redirect("/dashboard");

  const [categories, { currency, timezone }] = await Promise.all([
    listExpenseCategories(sb), getTenantSettings(sb),
  ]);
  return (
    <Page>
      <FormHeader backHref="/finanzas/gastos" backLabel="Gastos" title="Nuevo gasto"
        subtitle="Lo que ya pagaste. Cuenta de inmediato en la utilidad neta del mes." />
      <ExpenseForm action={createExpenseAction} categories={categories} currency={currency}
        hoy={todayISO(timezone)} submitLabel="Registrar gasto" cancelHref="/finanzas/gastos" />
    </Page>
  );
}
