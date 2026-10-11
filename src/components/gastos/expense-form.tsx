"use client";
import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { createExpenseCategoryNamed, type FormState } from "@/app/(app)/finanzas/gastos/actions";
import { FieldLabel } from "@/components/shared/field-label";
import { FormLayout, FormSection, FormGrid, FormWide, FormActions, FormAside } from "@/components/shared/form-shell";
import { Button } from "@/components/ui/button";
import { Field, fieldCls } from "@/components/ui/field";
import { DANGER_TEXT } from "@/lib/ui-tokens";

type Categoria = { id: string; name: string };
type Values = {
  id?: string; description?: string; amount?: string; spentOn?: string;
  categoryId?: string | null; paymentMethod?: string; supplier?: string; notes?: string;
};

const initial: FormState = { ok: false };

const AYUDA = [
  "Registra la salida el día en que la pagaste, no el día en que la cargas: así cae en el mes correcto.",
  "La categoría es lo que después te dice en qué se te va el dinero.",
  "El costo de la mercancía que vendes ya está contado en la utilidad bruta. Si lo cargas también aquí, lo restas dos veces.",
  "Lo que pagas todos los meses conviene crearlo como gasto fijo: te avisa y se registra con un clic.",
];

export function ExpenseForm({ action, categories, values = {}, submitLabel, cancelHref, currency, hoy }: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  categories: Categoria[]; values?: Values; submitLabel: string;
  cancelHref: string; currency: string; hoy: string;
}) {
  const [state, formAction, pending] = useActionState(action, initial);
  const [cats, setCats] = useState<Categoria[]>(categories);
  const [categoryId, setCategoryId] = useState(values.categoryId ?? "");
  const [adding, setAdding] = useState(false);
  const [nueva, setNueva] = useState("");
  const [catErr, setCatErr] = useState("");
  const [creating, setCreating] = useState(false);
  const err = (k: string) => state.fieldErrors?.[k];

  async function addCategoria() {
    setCreating(true); setCatErr("");
    const r = await createExpenseCategoryNamed(nueva);
    setCreating(false);
    if (!r.ok || !r.category) { setCatErr(r.error ?? "No se pudo crear"); return; }
    setCats((prev) => [...prev, r.category!].sort((a, b) => a.name.localeCompare(b.name)));
    setCategoryId(r.category.id); setNueva(""); setAdding(false);
  }

  return (
    <form action={formAction}>
      {values.id && <input type="hidden" name="id" defaultValue={values.id} />}
      <input type="hidden" name="categoryId" value={categoryId} />

      <FormLayout aside={<FormAside title="Qué hace esta pantalla" items={AYUDA} />}>
        <FormSection title="El gasto" hint="En qué se fue el dinero, cuánto y cuándo.">
          <FormGrid cols={2}>
            <Field id="description" error={err("description")}
              label={<FieldLabel htmlFor="description">En qué se gastó *</FieldLabel>}>
              {(p) => <input {...p} name="description" defaultValue={values.description ?? ""} autoFocus
                placeholder="Ej. Alquiler del local, octubre" className={fieldCls(!!err("description"))} />}
            </Field>
            <Field id="amount" error={err("amount")}
              label={<FieldLabel htmlFor="amount">Monto en {currency} *</FieldLabel>}>
              {(p) => <input {...p} name="amount" type="number" inputMode="decimal" step="0.01" min="0.01"
                defaultValue={values.amount ?? ""} placeholder="0,00" className={fieldCls(!!err("amount"))} />}
            </Field>
            <Field id="spentOn" error={err("spentOn")}
              label={<FieldLabel htmlFor="spentOn">Fecha del pago *</FieldLabel>}>
              {(p) => <input {...p} name="spentOn" type="date" defaultValue={values.spentOn ?? hoy}
                className={fieldCls(!!err("spentOn"))} />}
            </Field>
            <div>
              <FieldLabel htmlFor="categoryId">Categoría</FieldLabel>
              <div className="flex gap-2">
                <select id="categoryId" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}
                  className={fieldCls(false, "min-w-0")}>
                  <option value="">Sin categoría</option>
                  {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button type="button" onClick={() => setAdding((v) => !v)} aria-expanded={adding}
                  aria-label="Crear una categoría nueva"
                  className="inline-flex h-[42px] w-[42px] flex-none items-center justify-center rounded-[10px] border border-[var(--border)] text-[var(--text)] transition-colors hover:bg-[var(--bg)] active:scale-[0.98]">
                  <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
                </button>
              </div>
              {adding && (
                <div className="mt-2 flex animate-fade-up items-center gap-2 rounded-lg border border-dashed border-[var(--border)] p-2">
                  <label htmlFor="nueva-cat-gasto" className="sr-only">Nombre de la categoría nueva</label>
                  <input id="nueva-cat-gasto" value={nueva} onChange={(e) => setNueva(e.target.value)}
                    placeholder="Ej. Publicidad" className={fieldCls()} />
                  <Button variant="primary" type="button" onClick={addCategoria}
                    disabled={!nueva.trim()} loading={creating} className="flex-none">Crear</Button>
                </div>
              )}
              {catErr && <p className={`mt-1 text-xs ${DANGER_TEXT}`}>{catErr}</p>}
            </div>
          </FormGrid>
        </FormSection>

        <FormSection title="Detalle" hint="Opcional, pero ayuda a recordar de qué se trataba.">
          <FormGrid cols={2}>
            <div>
              <FieldLabel htmlFor="supplier">A quién se le pagó</FieldLabel>
              <input id="supplier" name="supplier" defaultValue={values.supplier ?? ""}
                placeholder="Ej. Inversiones López C.A." className={fieldCls()} />
            </div>
            <div>
              <FieldLabel htmlFor="paymentMethod" help="metodoPago">Cómo se pagó</FieldLabel>
              <input id="paymentMethod" name="paymentMethod" defaultValue={values.paymentMethod ?? ""}
                placeholder="Ej. Transferencia" className={fieldCls()} />
            </div>
            <FormWide>
              <label htmlFor="notes" className="mb-1 block text-xs font-medium text-[var(--text-soft)]">Notas</label>
              <textarea id="notes" name="notes" defaultValue={values.notes ?? ""} rows={2}
                placeholder="Ej. factura 0043, corresponde a octubre" className={fieldCls()} />
            </FormWide>
          </FormGrid>
        </FormSection>

        {state.error && (
          <p role="alert" className={`rounded-xl border border-[#b91c1c]/30 bg-[#b91c1c]/5 p-3 text-sm ${DANGER_TEXT}`}>
            {state.error}
          </p>
        )}
      </FormLayout>

      <FormActions cancelHref={cancelHref}>
        <Button variant="primary" loading={pending}>{pending ? "Guardando" : submitLabel}</Button>
      </FormActions>
    </form>
  );
}
