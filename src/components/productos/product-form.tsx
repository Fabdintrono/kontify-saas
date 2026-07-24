"use client";
import { useActionState, useState } from "react";
import { createCategoryNamed, type FormState } from "@/app/(app)/operaciones/productos/actions";

type Category = { id: string; name: string };
type TaxRate = { id: string; name: string; isDefault: boolean };
type Values = {
  id?: string; kind?: "good" | "service"; name?: string; sku?: string; description?: string;
  unit?: string; categoryId?: string | null; price?: string; cost?: string; taxRateId?: string | null;
};

const initial: FormState = { ok: false };
const inputCls = "w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[#0e7490]";
const labelCls = "mb-1 block text-xs font-medium text-[var(--text-soft)]";

export function ProductForm({ action, categories, taxRates, values = {}, submitLabel }: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  categories: Category[]; taxRates: TaxRate[]; values?: Values; submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, initial);
  const [localCats, setLocalCats] = useState<Category[]>(categories);
  const [categoryId, setCategoryId] = useState<string>(values.categoryId ?? "");
  const defaultTax = values.taxRateId ?? taxRates.find((t) => t.isDefault)?.id ?? "";
  const [adding, setAdding] = useState(false);
  const [newCat, setNewCat] = useState("");
  const [catErr, setCatErr] = useState("");
  const [creating, setCreating] = useState(false);
  const err = (k: string) => state.fieldErrors?.[k];

  async function addCategory() {
    setCreating(true); setCatErr("");
    const r = await createCategoryNamed(newCat);
    setCreating(false);
    if (!r.ok || !r.category) { setCatErr(r.error ?? "No se pudo crear"); return; }
    setLocalCats((prev) => [...prev, r.category!].sort((a, b) => a.name.localeCompare(b.name)));
    setCategoryId(r.category.id); setNewCat(""); setAdding(false);
  }

  return (
    <form action={formAction} className="max-w-xl space-y-3">
      {values.id && <input type="hidden" name="id" defaultValue={values.id} />}
      <input type="hidden" name="categoryId" value={categoryId} />
      <div>
        <label className={labelCls}>Tipo</label>
        <select name="kind" defaultValue={values.kind ?? "good"} className={inputCls}>
          <option value="good">Bien</option>
          <option value="service">Servicio</option>
        </select>
      </div>
      <div>
        <label className={labelCls}>Nombre *</label>
        <input name="name" defaultValue={values.name ?? ""} className={inputCls} />
        {err("name") && <p className="mt-1 text-xs text-[#dc2626]">{err("name")}</p>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={labelCls}>SKU / código</label><input name="sku" defaultValue={values.sku ?? ""} className={inputCls} /></div>
        <div><label className={labelCls}>Unidad</label><input name="unit" defaultValue={values.unit ?? "unidad"} className={inputCls} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Precio *</label>
          <input name="price" type="number" step="0.01" min="0" defaultValue={values.price ?? "0"} className={inputCls} />
          {err("price") && <p className="mt-1 text-xs text-[#dc2626]">{err("price")}</p>}
        </div>
        <div>
          <label className={labelCls}>Costo</label>
          <input name="cost" type="number" step="0.01" min="0" defaultValue={values.cost ?? ""} className={inputCls} />
          {err("cost") && <p className="mt-1 text-xs text-[#dc2626]">{err("cost")}</p>}
        </div>
      </div>
      <div>
        <label className={labelCls}>Impuesto</label>
        <select name="taxRateId" defaultValue={defaultTax} className={inputCls}>
          <option value="">Sin impuesto</option>
          {taxRates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>
      <div>
        <label className={labelCls}>Categoría</label>
        <div className="flex gap-2">
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputCls}>
            <option value="">Sin categoría</option>
            {localCats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button type="button" onClick={() => setAdding((v) => !v)}
            className="flex-none rounded-[10px] border border-[var(--border)] px-3 text-sm text-[var(--text)]">+ Categoría</button>
        </div>
        {adding && (
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-dashed border-[var(--border)] p-2">
            <input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="Nueva categoría (ej. Repuestos)" className={inputCls} />
            <button type="button" onClick={addCategory} disabled={creating || !newCat.trim()}
              className="flex-none rounded-[10px] bg-[#0e7490] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">
              {creating ? "…" : "Crear"}
            </button>
          </div>
        )}
        {catErr && <p className="mt-1 text-xs text-[#dc2626]">{catErr}</p>}
      </div>
      <div><label className={labelCls}>Descripción</label><textarea name="description" defaultValue={values.description ?? ""} rows={3} className={inputCls} /></div>

      {state.error && <p className="text-sm text-[#dc2626]">{state.error}</p>}
      <button disabled={pending} className="rounded-[10px] bg-gradient-to-br from-[#0e7490] to-[#14b8a6] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
        {pending ? "Guardando…" : submitLabel}
      </button>
    </form>
  );
}
