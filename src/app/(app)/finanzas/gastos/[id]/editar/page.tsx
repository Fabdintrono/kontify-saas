import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getExpense, listExpenseCategories } from "@/lib/gastos/queries";
import { canManageExpenses, canDeleteExpense } from "@/lib/gastos/permissions";
import { getTenantSettings } from "@/lib/tenant";
import { todayISO } from "@/lib/tz";
import { ExpenseForm } from "@/components/gastos/expense-form";
import { FormHeader } from "@/components/shared/form-shell";
import { Page } from "@/components/shared/page";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { buttonCls } from "@/components/ui/button";
import { flashFor } from "@/lib/flash";
import { updateExpenseAction, deleteExpenseAction } from "../../actions";
import type { Role } from "@/lib/auth/roles";

export default async function EditarGastoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  const { data: mem } = await sb.from("memberships").select("role").eq("user_id", user!.id).single();
  const role = (mem?.role ?? "vendedor") as Role;
  if (!canManageExpenses(role)) redirect("/dashboard");

  const [gasto, categories, { currency, timezone }] = await Promise.all([
    getExpense(sb, id), listExpenseCategories(sb), getTenantSettings(sb),
  ]);
  if (!gasto) notFound();

  return (
    <Page>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <FormHeader backHref="/finanzas/gastos" backLabel="Gastos" title="Editar gasto"
          subtitle="Corrige lo que haga falta. La utilidad del mes se recalcula sola." />
        {canDeleteExpense(role) && (
          <ConfirmDialog action={deleteExpenseAction} payload={{ id: gasto.id }}
            title={`¿Eliminar «${gasto.description}»?`}
            description="Deja de restar en la utilidad del mes. No se puede deshacer."
            confirmLabel="Eliminar" tone="danger" successToast={flashFor("gasto-eliminado")}
            triggerClassName={buttonCls("danger")}>
            Eliminar
          </ConfirmDialog>
        )}
      </div>
      <ExpenseForm action={updateExpenseAction} categories={categories} currency={currency}
        hoy={todayISO(timezone)} submitLabel="Guardar cambios" cancelHref="/finanzas/gastos"
        values={{
          id: gasto.id, description: gasto.description, amount: String(gasto.amount),
          spentOn: gasto.spentOn, categoryId: gasto.categoryId ?? "",
          paymentMethod: gasto.paymentMethod ?? "", supplier: gasto.supplier ?? "", notes: gasto.notes ?? "",
        }} />
    </Page>
  );
}
