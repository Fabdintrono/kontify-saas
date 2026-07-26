"use client";
import { useActionState, useState } from "react";
import { Trash2 } from "lucide-react";
import { submitQuoteAction, type FormState } from "@/app/(app)/operaciones/presupuestos/actions";
import { computeSaleTotals } from "@/lib/ventas/totals";
import { formatMoney } from "@/lib/format";
import { ClientPicker, type LiteClient } from "@/components/ventas/client-picker";
import { ProductPicker, type LiteProduct } from "@/components/ventas/product-picker";

type Line = { productId: string | null; description: string; quantity: number; unitPrice: number; discountPct: number; taxRate: number };
type Branch = { id: string; name: string; is_main: boolean };
type Values = { id?: string; clientId?: string | null; branchId?: string; globalDiscountPct?: number; validUntil?: string; notes?: string; items?: Line[] };

const initial: FormState = { ok: false };
const inputCls = "w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[#0e7490]";
const labelCls = "mb-1 block text-xs font-medium text-[var(--text-soft)]";
const cell = "w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm text-[var(--text)] outline-none focus:border-[#0e7490]";

export function QuoteBuilder({ clients, products, branches, role, userBranchId, currency, values = {} }: {
  clients: LiteClient[]; products: LiteProduct[]; branches: Branch[];
  role: string; userBranchId: string | null; currency: string; values?: Values;
}) {
  const [state, formAction, pending] = useActionState(submitQuoteAction, initial);
  const isBackOffice = ["owner", "admin", "administrativo"].includes(role);
  const defaultBranch = values.branchId ?? userBranchId ?? branches.find((b) => b.is_main)?.id ?? branches[0]?.id ?? "";

  const [clientId, setClientId] = useState<string | null>(values.clientId ?? null);
  const [branchId, setBranchId] = useState<string>(defaultBranch);
  const [globalDiscountPct, setGlobalDiscountPct] = useState<number>(values.globalDiscountPct ?? 0);
  const [validUntil, setValidUntil] = useState<string>(values.validUntil ?? "");
  const [notes, setNotes] = useState<string>(values.notes ?? "");
  const [lines, setLines] = useState<Line[]>(values.items ?? []);

  const totals = computeSaleTotals(lines, globalDiscountPct);
  const setLine = (i: number, patch: Partial<Line>) => setLines((prev) => prev.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  const addProduct = (p: LiteProduct) =>
    setLines((prev) => [...prev, { productId: p.id, description: p.name, quantity: 1, unitPrice: p.price, discountPct: 0, taxRate: p.taxRate }]);
  const num = (v: string) => (v === "" ? 0 : Number(v));

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="id" value={values.id ?? ""} />
      <input type="hidden" name="clientId" value={clientId ?? ""} />
      <input type="hidden" name="branchId" value={branchId} />
      <input type="hidden" name="globalDiscountPct" value={globalDiscountPct} />
      <input type="hidden" name="validUntil" value={validUntil} />
      <input type="hidden" name="notes" value={notes} />
      <input type="hidden" name="items" value={JSON.stringify(lines)} />

      <div className="grid gap-3 sm:grid-cols-3">
        <div><label className={labelCls}>Cliente</label><ClientPicker clients={clients} value={clientId} onChange={setClientId} /></div>
        {isBackOffice && (
          <div><label className={labelCls}>Sucursal</label>
            <select className={inputCls} value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
        )}
        <div><label className={labelCls}>Válido hasta</label>
          <input type="date" className={inputCls} value={validUntil} onChange={(e) => setValidUntil(e.target.value)} /></div>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
        <div className="mb-2"><ProductPicker products={products} onPick={addProduct} /></div>
        {lines.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--text-soft)]">Agrega productos al presupuesto.</p>
        ) : (
          <div className="space-y-2">
            <div className="hidden grid-cols-12 gap-2 px-1 text-xs text-[var(--text-soft)] lg:grid">
              <span className="col-span-4">Producto</span><span className="col-span-2">Cant.</span>
              <span className="col-span-2">Precio</span><span className="col-span-1">Desc%</span>
              <span className="col-span-1">IVA%</span><span className="col-span-2 text-right">Neto</span>
            </div>
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-12 items-center gap-2">
                <input className={`${cell} col-span-4`} value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} />
                <input className={`${cell} col-span-2`} type="number" step="0.01" min="0" value={l.quantity} onChange={(e) => setLine(i, { quantity: num(e.target.value) })} />
                <input className={`${cell} col-span-2`} type="number" step="0.01" min="0" value={l.unitPrice} onChange={(e) => setLine(i, { unitPrice: num(e.target.value) })} />
                <input className={`${cell} col-span-1`} type="number" step="0.01" min="0" max="100" value={l.discountPct} onChange={(e) => setLine(i, { discountPct: num(e.target.value) })} />
                <input className={`${cell} col-span-1`} type="number" step="0.01" min="0" max="100" value={l.taxRate} onChange={(e) => setLine(i, { taxRate: num(e.target.value) })} />
                <div className="col-span-2 flex items-center justify-end gap-2">
                  <span className="text-sm text-[var(--text)]">{formatMoney(totals.lines[i]?.neto ?? 0, currency)}</span>
                  <button type="button" onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))} className="text-[var(--text-soft)] hover:text-[#dc2626]">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className={labelCls}>Notas</label><textarea className={inputCls} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 text-sm">
          <Row label="Subtotal" value={formatMoney(totals.subtotal, currency)} />
          <div className="flex items-center justify-between py-1">
            <span className="text-[var(--text-soft)]">Descuento global %</span>
            <input className={`${cell} w-20 text-right`} type="number" step="0.01" min="0" max="100" value={globalDiscountPct} onChange={(e) => setGlobalDiscountPct(num(e.target.value))} />
          </div>
          <Row label="Descuentos" value={formatMoney(totals.discountTotal, currency)} />
          <Row label="Impuesto" value={formatMoney(totals.taxTotal, currency)} />
          <div className="mt-1 flex items-center justify-between border-t border-[var(--border)] pt-2 text-base font-bold text-[var(--text)]">
            <span>Total</span><span>{formatMoney(totals.total, currency)}</span>
          </div>
        </div>
      </div>

      {state.error && <p className="text-sm text-[#dc2626]">{state.error}</p>}
      {state.fieldErrors && <p className="text-sm text-[#dc2626]">{Object.values(state.fieldErrors)[0]}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <button name="intent" value="save" disabled={pending}
          className="rounded-[10px] border border-[var(--border)] px-4 py-2.5 text-sm font-semibold text-[var(--text)] disabled:opacity-60">
          {pending ? "Guardando…" : "Guardar borrador"}
        </button>
        <button name="intent" value="send" disabled={pending || lines.length === 0}
          className="rounded-[10px] bg-gradient-to-br from-[#0e7490] to-[#14b8a6] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
          {pending ? "Enviando…" : "Enviar"}
        </button>
      </div>
    </form>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between py-1"><span className="text-[var(--text-soft)]">{label}</span><span className="text-[var(--text)]">{value}</span></div>;
}
