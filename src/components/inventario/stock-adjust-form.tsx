"use client";
import { useActionState, useEffect, useState } from "react";
import { registerAdjustmentAction, type FormState } from "@/app/(app)/operaciones/inventario/actions";

type LiteProduct = { id: string; name: string };
type Branch = { id: string; name: string };

const initial: FormState = { ok: false };
const inputCls = "w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[#0e7490]";
const labelCls = "mb-1 block text-xs font-medium text-[var(--text-soft)]";

export function StockAdjustForm({ products, productId, branches, userBranchId, isBackOffice }: {
  products?: LiteProduct[]; productId?: string; branches: Branch[]; userBranchId: string | null; isBackOffice: boolean;
}) {
  const [state, formAction, pending] = useActionState(registerAdjustmentAction, initial);
  const [open, setOpen] = useState(false);
  const defaultBranch = userBranchId ?? branches.find((b) => b)?.id ?? "";
  const err = (k: string) => state.fieldErrors?.[k];
  useEffect(() => { if (state.ok) setOpen(false); }, [state]);

  if (!open) return (
    <button type="button" onClick={() => setOpen(true)}
      className="rounded-[10px] bg-gradient-to-br from-[#0e7490] to-[#14b8a6] px-3 py-2 text-sm font-semibold text-white">
      Registrar movimiento
    </button>
  );

  return (
    <form action={formAction} className="max-w-md space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <p className="text-sm font-bold text-[var(--text)]">Registrar movimiento</p>
      {productId
        ? <input type="hidden" name="productId" value={productId} />
        : (
          <div>
            <label className={labelCls}>Producto</label>
            <select name="productId" className={inputCls} defaultValue="">
              <option value="" disabled>Selecciona…</option>
              {(products ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {err("productId") && <p className="mt-1 text-xs text-[#dc2626]">{err("productId")}</p>}
          </div>
        )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Sucursal</label>
          {isBackOffice
            ? <select name="branchId" className={inputCls} defaultValue={defaultBranch}>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
            : <input type="hidden" name="branchId" value={defaultBranch} />}
          {!isBackOffice && <p className="py-2 text-sm text-[var(--text)]">{branches.find((b) => b.id === defaultBranch)?.name ?? "—"}</p>}
        </div>
        <div>
          <label className={labelCls}>Movimiento</label>
          <select name="direction" className={inputCls} defaultValue="in">
            <option value="in">Entrada (+)</option>
            <option value="out">Salida (−)</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Cantidad</label>
          <input name="quantity" type="number" step="0.01" min="0" defaultValue="1" className={inputCls} />
          {err("quantity") && <p className="mt-1 text-xs text-[#dc2626]">{err("quantity")}</p>}
        </div>
        <div><label className={labelCls}>Motivo</label><input name="reason" className={inputCls} placeholder="Carga inicial, merma…" /></div>
      </div>
      {state.error && <p className="text-sm text-[#dc2626]">{state.error}</p>}
      <div className="flex gap-2">
        <button disabled={pending} className="rounded-[10px] bg-gradient-to-br from-[#0e7490] to-[#14b8a6] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
          {pending ? "Guardando…" : "Guardar"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-[10px] border border-[var(--border)] px-4 py-2.5 text-sm text-[var(--text)]">Cancelar</button>
      </div>
    </form>
  );
}
