import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listTaxRates } from "@/lib/productos/queries";
import { canManageTaxRates } from "@/lib/productos/permissions";
import { createTaxRateFormAction, updateTaxRateAction } from "@/app/(app)/operaciones/productos/actions";
import type { Role } from "@/lib/auth/roles";

export default async function TasasDeImpuestoPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  const { data: mem } = await sb.from("memberships").select("role").eq("user_id", user!.id).single();
  const role = (mem?.role ?? "vendedor") as Role;
  if (!canManageTaxRates(role)) redirect("/dashboard");

  const rates = await listTaxRates(sb, { includeInactive: true });
  const inputCls = "h-9 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text)] outline-none focus:border-[#0e7490]";

  return (
    <div className="max-w-2xl space-y-4 p-6">
      <h1 className="text-xl font-extrabold tracking-[-0.4px] text-[var(--text)]">Tasas de impuesto</h1>

      <form action={createTaxRateFormAction} className="flex flex-wrap items-center gap-2">
        <input name="name" placeholder="Nombre (ej. IVA 16%)" className={`${inputCls} flex-1`} />
        <input name="rate" type="number" step="0.01" min="0" max="100" placeholder="%" className={`${inputCls} w-24`} />
        <label className="flex items-center gap-1 text-sm text-[var(--text-soft)]">
          <input type="checkbox" name="isDefault" value="true" /> Predet.
        </label>
        <button className="rounded-[10px] bg-gradient-to-br from-[#0e7490] to-[#14b8a6] px-4 text-sm font-semibold text-white">Añadir</button>
      </form>

      <ul className="divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        {rates.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center gap-2 p-3">
            <form action={updateTaxRateAction} className="flex flex-1 flex-wrap items-center gap-2">
              <input type="hidden" name="id" value={t.id} />
              <input name="name" defaultValue={t.name} className={`${inputCls} flex-1`} />
              <input name="rate" type="number" step="0.01" min="0" max="100" defaultValue={t.rate} className={`${inputCls} w-24`} />
              {t.isDefault
                ? <span className="rounded-full bg-[#0e7490]/10 px-2 py-0.5 text-xs font-medium text-[#0e7490] dark:text-[#5eead4]">Predet.</span>
                : <button name="isDefault" value="true" className="rounded-[10px] border border-[var(--border)] px-2 py-1.5 text-xs text-[var(--text-soft)]">Hacer predet.</button>}
              <button className="rounded-[10px] border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--text)]">Guardar</button>
            </form>
            <form action={updateTaxRateAction}>
              <input type="hidden" name="id" value={t.id} />
              <input type="hidden" name="active" value={t.active ? "false" : "true"} />
              <button className="rounded-[10px] border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--text-soft)]">
                {t.active ? "Desactivar" : "Activar"}
              </button>
            </form>
          </li>
        ))}
      </ul>
      <p className="text-xs text-[var(--text-soft)]">La tasa predeterminada se preselecciona al crear productos. Solo puede haber una.</p>
    </div>
  );
}
