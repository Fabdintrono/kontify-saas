"use client";
import { useActionState, useState } from "react";
import { Trash2 } from "lucide-react";
import { submitSaleAction, type FormState } from "@/app/(app)/operaciones/facturacion/actions";
import { useSubmitIntent } from "@/components/shared/use-submit-intent";
import { FieldLabel } from "@/components/shared/field-label";
import { FieldHelp } from "@/components/shared/field-help";
import { Button } from "@/components/ui/button";
import { computeSaleTotals } from "@/lib/ventas/totals";
import { formatMoney } from "@/lib/format";
import { ClientPicker, type LiteClient } from "./client-picker";
import { ProductPicker, type LiteProduct } from "./product-picker";
import { DANGER_TEXT, DANGER_TEXT_HOVER } from "@/lib/ui-tokens";
import { FIELD, FIELD_CELL } from "@/components/ui/field";

type Line = { productId: string | null; description: string; quantity: number; unitPrice: number; discountPct: number; taxRate: number };
type Branch = { id: string; name: string; is_main: boolean };
type Values = { id?: string; clientId?: string | null; branchId?: string; globalDiscountPct?: number; notes?: string; items?: Line[] };

const initial: FormState = { ok: false };
const inputCls = FIELD;
const cell = FIELD_CELL;
// En el teléfono cada línea es una tarjeta y cada campo lleva su rótulo; en escritorio
// el rótulo queda solo para lectores de pantalla y manda la tira de cabeceras.
const lineLabel = "mb-1 block text-xs font-medium text-[var(--text-soft)] lg:sr-only";

export function SaleBuilder({ clients, products, branches, role, userBranchId, currency, values = {} }: {
  clients: LiteClient[]; products: LiteProduct[]; branches: Branch[];
  role: string; userBranchId: string | null; currency: string; values?: Values;
}) {
  const [state, formAction, pending] = useActionState(submitSaleAction, initial);
  const submit = useSubmitIntent<"save" | "emit">(pending);
  const isBackOffice = ["owner", "admin", "administrativo"].includes(role);
  const defaultBranch = values.branchId ?? userBranchId ?? branches.find((b) => b.is_main)?.id ?? branches[0]?.id ?? "";

  const [clientId, setClientId] = useState<string | null>(values.clientId ?? null);
  const [branchId, setBranchId] = useState<string>(defaultBranch);
  const [globalDiscountPct, setGlobalDiscountPct] = useState<number>(values.globalDiscountPct ?? 0);
  const [notes, setNotes] = useState<string>(values.notes ?? "");
  const [lines, setLines] = useState<Line[]>(values.items ?? []);
  const [emitOpen, setEmitOpen] = useState(false);
  const [paymentType, setPaymentType] = useState<"contado" | "credito">("contado");

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
      <input type="hidden" name="notes" value={notes} />
      <input type="hidden" name="items" value={JSON.stringify(lines)} />
      <input type="hidden" name="paymentType" value={paymentType} />

      <div className="grid gap-3 sm:grid-cols-2">
        <div><FieldLabel htmlFor="clientId">Cliente</FieldLabel><ClientPicker inputId="clientId" clients={clients} value={clientId} onChange={setClientId} /></div>
        {isBackOffice && (
          <div><FieldLabel htmlFor="branchId" help="sucursal">Sucursal</FieldLabel>
            <select id="branchId" className={inputCls} value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
        <div className="mb-2">
          <FieldLabel htmlFor="productPicker">Agregar producto</FieldLabel>
          <ProductPicker inputId="productPicker" products={products} onPick={addProduct} />
        </div>
        {lines.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--text-soft)]">Agrega productos a la venta.</p>
        ) : (
          <div className="space-y-2">
            <div className="hidden grid-cols-12 gap-2 px-1 text-xs text-[var(--text-soft)] lg:grid">
              <span className="col-span-4">Producto</span><span className="col-span-2">Cant.</span>
              <span className="col-span-2">Precio</span><span className="col-span-1">Desc%</span>
              <span className="col-span-1">IVA%</span><span className="col-span-2 text-right">Neto</span>
            </div>
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-2 gap-2 rounded-xl border border-[var(--border)] p-3 lg:grid-cols-12 lg:items-center lg:gap-2 lg:rounded-none lg:border-0 lg:p-0">
                <div className="col-span-2 lg:col-span-4">
                  <label htmlFor={`l${i}-desc`} className={lineLabel}>Producto</label>
                  <input id={`l${i}-desc`} className={cell} value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} />
                </div>
                <div className="lg:col-span-2">
                  <label htmlFor={`l${i}-qty`} className={lineLabel}>Cant.</label>
                  <input id={`l${i}-qty`} className={cell} type="number" step="0.01" min="0" value={l.quantity} onChange={(e) => setLine(i, { quantity: num(e.target.value) })} />
                </div>
                <div className="lg:col-span-2">
                  <label htmlFor={`l${i}-price`} className={lineLabel}>Precio</label>
                  <input id={`l${i}-price`} className={cell} type="number" step="0.01" min="0" value={l.unitPrice} onChange={(e) => setLine(i, { unitPrice: num(e.target.value) })} />
                </div>
                <div className="lg:col-span-1">
                  <label htmlFor={`l${i}-disc`} className={lineLabel}>Desc. %</label>
                  <input id={`l${i}-disc`} className={cell} type="number" step="0.01" min="0" max="100" value={l.discountPct} onChange={(e) => setLine(i, { discountPct: num(e.target.value) })} />
                </div>
                <div className="lg:col-span-1">
                  <label htmlFor={`l${i}-tax`} className={lineLabel}>IVA %</label>
                  <input id={`l${i}-tax`} className={cell} type="number" step="0.01" min="0" max="100" value={l.taxRate} onChange={(e) => setLine(i, { taxRate: num(e.target.value) })} />
                </div>
                <div className="col-span-2 flex items-center justify-between gap-2 border-t border-[var(--border)] pt-2 lg:col-span-2 lg:justify-end lg:border-0 lg:pt-0">
                  <span className="flex items-baseline gap-2">
                    <span className="text-xs font-medium text-[var(--text-soft)] lg:hidden">Neto</span>
                    <span className="text-sm text-[var(--text)]">{formatMoney(totals.lines[i]?.neto ?? 0, currency)}</span>
                  </span>
                  <button type="button" aria-label={`Quitar ${l.description || "línea"}`} onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))} className={`-mr-1 rounded-md p-2 text-[var(--text-soft)] lg:mr-0 lg:p-0 ${DANGER_TEXT_HOVER}`}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div><FieldLabel htmlFor="notes">Notas</FieldLabel><textarea id="notes" className={inputCls} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 text-sm">
          <Row label="Subtotal" value={formatMoney(totals.subtotal, currency)} />
          <div className="flex items-center justify-between py-1">
            <span className="flex items-center gap-1.5 text-[var(--text-soft)]">
              <label htmlFor="globalDiscountPct">Descuento global %</label>
              <FieldHelp help="descuentoGlobal" label="Descuento global %" />
            </span>
            <input id="globalDiscountPct" className={`${cell} w-20 text-right`} type="number" step="0.01" min="0" max="100" value={globalDiscountPct} onChange={(e) => setGlobalDiscountPct(num(e.target.value))} />
          </div>
          <Row label="Descuentos" value={formatMoney(totals.discountTotal, currency)} />
          <Row label="Impuesto" value={formatMoney(totals.taxTotal, currency)} />
          <div className="mt-1 flex items-center justify-between border-t border-[var(--border)] pt-2 text-base font-bold text-[var(--text)]">
            <span>Total</span><span>{formatMoney(totals.total, currency)}</span>
          </div>
        </div>
      </div>

      {state.error && <p className={`text-sm ${DANGER_TEXT}`}>{state.error}</p>}
      {state.fieldErrors && <p className={`text-sm ${DANGER_TEXT}`}>{Object.values(state.fieldErrors)[0]}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <Button name="intent" value="save" variant="secondary" disabled={pending} onClick={() => submit.mark("save")}>
          {submit.isPending("save") ? "Guardando…" : "Guardar borrador"}
        </Button>
        <Button type="button" variant="primary" onClick={() => setEmitOpen((v) => !v)} disabled={lines.length === 0}>
          Emitir
        </Button>
      </div>

      {emitOpen && (
        <div className="max-w-md space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-sm font-bold text-[var(--text)]">Emitir venta — {formatMoney(totals.total, currency)}</p>
          <div className="flex gap-2">
            <label className={`flex-1 cursor-pointer rounded-[10px] border px-3 py-2 text-sm ${paymentType === "contado" ? "border-[#0e7490] text-[#0e7490]" : "border-[var(--border)] text-[var(--text)]"}`}>
              <input type="radio" className="mr-2" checked={paymentType === "contado"} onChange={() => setPaymentType("contado")} />Contado
            </label>
            <label className={`flex-1 cursor-pointer rounded-[10px] border px-3 py-2 text-sm ${paymentType === "credito" ? "border-[#0e7490] text-[#0e7490]" : "border-[var(--border)] text-[var(--text)]"}`}>
              <input type="radio" className="mr-2" checked={paymentType === "credito"} onChange={() => setPaymentType("credito")} />Crédito
            </label>
          </div>
          {paymentType === "contado" && (
            <div><FieldLabel htmlFor="paymentMethod" help="metodoPago">Método de pago (opcional)</FieldLabel>
              <input id="paymentMethod" name="paymentMethod" className={inputCls} placeholder="Efectivo, transferencia…" /></div>
          )}
          {paymentType === "credito" && (
            <div><FieldLabel htmlFor="dueDate" help="vencimiento">Fecha de vencimiento (opcional)</FieldLabel>
              <input id="dueDate" name="dueDate" type="date" className={inputCls} /></div>
          )}
          <Button name="intent" value="emit" variant="primary" className="w-full" disabled={pending} onClick={() => submit.mark("emit")}>
            {submit.isPending("emit") ? "Emitiendo…" : "Confirmar emisión"}
          </Button>
        </div>
      )}
    </form>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between py-1"><span className="text-[var(--text-soft)]">{label}</span><span className="text-[var(--text)]">{value}</span></div>;
}
