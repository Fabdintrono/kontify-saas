"use client";
import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { createCategoryNamed, type FormState } from "@/app/(app)/operaciones/productos/actions";
import { FieldLabel } from "@/components/shared/field-label";
import { FormLayout, FormSection, FormGrid, FormWide, FormActions, FormAside } from "@/components/shared/form-shell";
import { Button } from "@/components/ui/button";
import { Field, fieldCls } from "@/components/ui/field";
import { DANGER_TEXT } from "@/lib/ui-tokens";

type Category = { id: string; name: string };
type TaxRate = { id: string; name: string; isDefault: boolean };
type Values = {
  id?: string; kind?: "good" | "service"; name?: string; sku?: string; description?: string;
  unit?: string; categoryId?: string | null; price?: string; cost?: string; taxRateId?: string | null; minStock?: string;
};

const initial: FormState = { ok: false };

const AYUDA = [
  "Un «bien» descuenta existencia al vender. Un «servicio» no toca el inventario.",
  "El costo es solo tuyo: vendedores y cajeros no lo ven. Sirve para saber cuánto ganas.",
  "El stock mínimo es el aviso: por debajo de él, el inicio marca el producto en «bajo».",
  "Crear el producto no carga existencia. Eso se hace desde Inventario con «Ajustar stock».",
];

/** Margen sobre el precio de venta, que es como se lee en comercio: de cada bolívar
 *  que entra, cuánto queda. Devuelve null si falta un dato o el precio es cero. */
function margen(precio: string, costo: string): { pct: number; ganancia: number } | null {
  const p = Number(precio), c = Number(costo);
  if (!Number.isFinite(p) || !Number.isFinite(c) || p <= 0 || costo.trim() === "") return null;
  return { pct: Math.round(((p - c) / p) * 1000) / 10, ganancia: Math.round((p - c) * 100) / 100 };
}

export function ProductForm({ action, categories, taxRates, values = {}, submitLabel, cancelHref, currency }: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  categories: Category[]; taxRates: TaxRate[]; values?: Values;
  submitLabel: string; cancelHref: string; currency: string;
}) {
  const [state, formAction, pending] = useActionState(action, initial);
  const [localCats, setLocalCats] = useState<Category[]>(categories);
  const [categoryId, setCategoryId] = useState<string>(values.categoryId ?? "");
  const [kind, setKind] = useState<"good" | "service">(values.kind ?? "good");
  const [price, setPrice] = useState(values.price ?? "0");
  const [cost, setCost] = useState(values.cost ?? "");
  const defaultTax = values.taxRateId ?? taxRates.find((t) => t.isDefault)?.id ?? "";
  const [adding, setAdding] = useState(false);
  const [newCat, setNewCat] = useState("");
  const [catErr, setCatErr] = useState("");
  const [creating, setCreating] = useState(false);
  const err = (k: string) => state.fieldErrors?.[k];
  const m = margen(price, cost);

  async function addCategory() {
    setCreating(true); setCatErr("");
    const r = await createCategoryNamed(newCat);
    setCreating(false);
    if (!r.ok || !r.category) { setCatErr(r.error ?? "No se pudo crear"); return; }
    setLocalCats((prev) => [...prev, r.category!].sort((a, b) => a.name.localeCompare(b.name)));
    setCategoryId(r.category.id); setNewCat(""); setAdding(false);
  }

  return (
    <form action={formAction}>
      {values.id && <input type="hidden" name="id" defaultValue={values.id} />}
      <input type="hidden" name="categoryId" value={categoryId} />

      <FormLayout aside={<FormAside title="Qué hace esta pantalla" items={AYUDA} />}>
        <FormSection title="Qué vendes" hint="El nombre es lo único obligatorio.">
          <FormGrid cols={2}>
            <div>
              <FieldLabel htmlFor="kind">Tipo</FieldLabel>
              <select id="kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value as "good" | "service")}
                className={fieldCls()}>
                <option value="good">Bien (descuenta existencia)</option>
                <option value="service">Servicio (no toca inventario)</option>
              </select>
            </div>
            <Field id="name" error={err("name")} label={<FieldLabel htmlFor="name">Nombre *</FieldLabel>}>
              {(p) => <input {...p} name="name" defaultValue={values.name ?? ""} autoFocus
                placeholder="Ej. Agua mineral 1.5L" className={fieldCls(!!err("name"))} />}
            </Field>
            <div>
              <FieldLabel htmlFor="sku" help="sku">SKU o código</FieldLabel>
              <input id="sku" name="sku" defaultValue={values.sku ?? ""}
                placeholder="Ej. AGU-15" className={fieldCls()} />
            </div>
            <div>
              <FieldLabel htmlFor="unit" help="unidad">Unidad</FieldLabel>
              <input id="unit" name="unit" defaultValue={values.unit ?? "unidad"}
                placeholder="Ej. caja, kg, litro" className={fieldCls()} />
            </div>
            <div>
              <FieldLabel htmlFor="categoryId">Categoría</FieldLabel>
              <div className="flex gap-2">
                <select id="categoryId" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={fieldCls()}>
                  <option value="">Sin categoría</option>
                  {localCats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button type="button" onClick={() => setAdding((v) => !v)} aria-expanded={adding}
                  className="inline-flex h-[42px] flex-none items-center gap-1 rounded-[10px] border border-[var(--border)] px-3 text-sm font-medium text-[var(--text)] transition-colors hover:bg-[var(--bg)] active:scale-[0.98]">
                  <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" /> Categoría
                </button>
              </div>
              {adding && (
                <div className="mt-2 flex animate-fade-up items-center gap-2 rounded-lg border border-dashed border-[var(--border)] p-2">
                  <label htmlFor="nueva-categoria-prod" className="sr-only">Nombre de la nueva categoría</label>
                  <input id="nueva-categoria-prod" value={newCat} onChange={(e) => setNewCat(e.target.value)}
                    placeholder="Ej. Repuestos" className={fieldCls()} />
                  <Button variant="primary" type="button" onClick={addCategory}
                    disabled={!newCat.trim()} loading={creating} className="flex-none">Crear</Button>
                </div>
              )}
              {catErr && <p className={`mt-1 text-xs ${DANGER_TEXT}`}>{catErr}</p>}
            </div>
            <FormWide>
              <label htmlFor="description" className="mb-1 block text-xs font-medium text-[var(--text-soft)]">Descripción</label>
              <textarea id="description" name="description" defaultValue={values.description ?? ""} rows={2}
                placeholder="Lo que aparece en el documento de venta, si quieres detallarlo" className={fieldCls()} />
            </FormWide>
          </FormGrid>
        </FormSection>

        <FormSection title="Precio e impuesto" hint="El margen se calcula solo mientras escribes.">
          <FormGrid cols={3}>
            <Field id="price" error={err("price")} label={<FieldLabel htmlFor="price">Precio de venta *</FieldLabel>}>
              {(p) => <input {...p} name="price" type="number" inputMode="decimal" step="0.01" min="0"
                value={price} onChange={(e) => setPrice(e.target.value)} className={fieldCls(!!err("price"))} />}
            </Field>
            <Field id="cost" error={err("cost")} label={<FieldLabel htmlFor="cost" help="costo">Costo</FieldLabel>}>
              {(p) => <input {...p} name="cost" type="number" inputMode="decimal" step="0.01" min="0"
                value={cost} onChange={(e) => setCost(e.target.value)} placeholder="Opcional"
                className={fieldCls(!!err("cost"))} />}
            </Field>
            <div>
              <FieldLabel htmlFor="taxRateId" help="impuesto">Impuesto</FieldLabel>
              <select id="taxRateId" name="taxRateId" defaultValue={defaultTax} className={fieldCls()}>
                <option value="">Sin impuesto</option>
                {taxRates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </FormGrid>
          {/* `role="status"`: el margen cambia sin que el usuario pulse nada, así que
              un lector de pantalla debe poder enterarse sin perder el foco del campo. */}
          <p role="status" className="mt-3 min-h-5 text-xs text-[var(--text-soft)]">
            {m
              ? <>Margen: <span className={`font-semibold ${m.pct < 0 ? DANGER_TEXT : "text-[#0f766e] dark:text-[#6ee7b7]"}`}>{m.pct}%</span>
                  {" · "}ganas {currency} {m.ganancia.toFixed(2)} por {values.unit || "unidad"}</>
              : "Escribe precio y costo para ver el margen."}
          </p>
        </FormSection>

        {kind === "good" && (
          <FormSection title="Inventario" hint="Crear el producto no carga existencia: eso se hace en Inventario.">
            <FormGrid cols={3}>
              <Field id="minStock" error={err("minStock")}
                label={<FieldLabel htmlFor="minStock" help="stockMinimo">Stock mínimo</FieldLabel>}>
                {(p) => <input {...p} name="minStock" type="number" inputMode="decimal" step="0.01" min="0"
                  defaultValue={values.minStock ?? "0"} className={fieldCls(!!err("minStock"))} />}
              </Field>
            </FormGrid>
          </FormSection>
        )}
        {/* El servicio no tiene existencia, pero el campo debe viajar igual: el esquema lo exige. */}
        {kind === "service" && <input type="hidden" name="minStock" value={values.minStock ?? "0"} />}

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
