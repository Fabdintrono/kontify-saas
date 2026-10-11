"use client";
import { useActionState, useState } from "react";
import type { FormState } from "@/app/(app)/finanzas/gastos/actions";
import { FieldLabel } from "@/components/shared/field-label";
import { FormLayout, FormSection, FormGrid, FormActions, FormAside } from "@/components/shared/form-shell";
import { Button } from "@/components/ui/button";
import { Field, fieldCls } from "@/components/ui/field";
import { FRECUENCIAS, FRECUENCIA_LABEL, type Frecuencia } from "@/lib/gastos/schema";
import { siguienteFecha } from "@/lib/gastos/schedule";
import { formatDateOnly } from "@/lib/format";
import { DANGER_TEXT } from "@/lib/ui-tokens";

type Categoria = { id: string; name: string };
type Values = {
  id?: string; description?: string; amount?: string;
  frequency?: Frecuencia; nextDue?: string; categoryId?: string | null;
};

const initial: FormState = { ok: false };

const AYUDA = [
  "Un gasto fijo no es un pago: es un recordatorio con monto y fecha.",
  "Cuando llegue el día, en la lista aparece «Registrar pago». Ese clic crea el gasto del mes y mueve la fecha a la siguiente.",
  "Si el día que eliges no existe en algún mes, se usa el último de ese mes y después vuelve a tu día.",
  "Mientras no registres el pago, el monto cuenta en «Por pagar» del inicio, no en los gastos del mes.",
];

export function RecurringForm({ action, categories, values = {}, submitLabel, cancelHref, currency, hoy }: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  categories: Categoria[]; values?: Values; submitLabel: string;
  cancelHref: string; currency: string; hoy: string;
}) {
  const [state, formAction, pending] = useActionState(action, initial);
  const [frequency, setFrequency] = useState<Frecuencia>(values.frequency ?? "mensual");
  const [nextDue, setNextDue] = useState(values.nextDue ?? hoy);
  const err = (k: string) => state.fieldErrors?.[k];

  // Se muestra el pago siguiente para que se entienda la frecuencia sin tener que imaginarla.
  let despues = "";
  try { despues = formatDateOnly(siguienteFecha(nextDue, frequency, Number(nextDue.slice(8, 10)))); }
  catch { despues = ""; }

  return (
    <form action={formAction}>
      {values.id && <input type="hidden" name="id" defaultValue={values.id} />}

      <FormLayout aside={<FormAside title="Cómo funcionan los fijos" items={AYUDA} />}>
        <FormSection title="El gasto fijo" hint="Lo que pagas cada cierto tiempo: alquiler, nómina, internet.">
          <FormGrid cols={2}>
            <Field id="description" error={err("description")}
              label={<FieldLabel htmlFor="description">Qué gasto es *</FieldLabel>}>
              {(p) => <input {...p} name="description" defaultValue={values.description ?? ""} autoFocus
                placeholder="Ej. Alquiler del local" className={fieldCls(!!err("description"))} />}
            </Field>
            <Field id="amount" error={err("amount")}
              label={<FieldLabel htmlFor="amount">Monto en {currency} *</FieldLabel>}>
              {(p) => <input {...p} name="amount" type="number" inputMode="decimal" step="0.01" min="0.01"
                defaultValue={values.amount ?? ""} placeholder="0,00" className={fieldCls(!!err("amount"))} />}
            </Field>
            <Field id="frequency" error={err("frequency")}
              label={<FieldLabel htmlFor="frequency">Cada cuánto se paga *</FieldLabel>}>
              {(p) => (
                <select {...p} name="frequency" value={frequency}
                  onChange={(e) => setFrequency(e.target.value as Frecuencia)} className={fieldCls(!!err("frequency"))}>
                  {FRECUENCIAS.map((f) => <option key={f} value={f}>{FRECUENCIA_LABEL[f]}</option>)}
                </select>
              )}
            </Field>
            <Field id="nextDue" error={err("nextDue")}
              label={<FieldLabel htmlFor="nextDue">Próximo pago *</FieldLabel>}>
              {(p) => <input {...p} name="nextDue" type="date" value={nextDue}
                onChange={(e) => setNextDue(e.target.value)} className={fieldCls(!!err("nextDue"))} />}
            </Field>
            <div>
              <FieldLabel htmlFor="categoryId">Categoría</FieldLabel>
              <select id="categoryId" name="categoryId" defaultValue={values.categoryId ?? ""} className={fieldCls()}>
                <option value="">Sin categoría</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </FormGrid>
          {/* Cambia solo al tocar la fecha o la frecuencia: un lector de pantalla debe
              enterarse sin perder el foco del campo. */}
          <p role="status" className="mt-3 min-h-5 text-xs text-[var(--text-soft)]">
            {despues ? <>Después de ese, el siguiente sería el {despues}.</> : ""}
          </p>
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
