"use client";
import { useActionState, useEffect, useState } from "react";
import { registerAdjustmentAction, type FormState } from "@/app/(app)/operaciones/inventario/actions";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { flashFor } from "@/lib/flash";
import { FieldLabel } from "@/components/shared/field-label";

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
  const { toast } = useToast();
  const defaultBranch = userBranchId ?? branches.find((b) => b)?.id ?? "";
  const err = (k: string) => state.fieldErrors?.[k];
  useEffect(() => { if (state.ok) { setOpen(false); toast(flashFor("stock-ajustado")); } }, [state]);

  if (!open) return (
    <Button type="button" variant="primary" onClick={() => setOpen(true)}>
      Ajustar stock
    </Button>
  );

  return (
    <form action={formAction} className="w-full max-w-md space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <p className="text-sm font-bold text-[var(--text)]">Ajustar stock</p>
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
          <FieldLabel htmlFor="adjBranchId" help="sucursal">Sucursal</FieldLabel>
          {isBackOffice
            ? <select id="adjBranchId" name="branchId" className={inputCls} defaultValue={defaultBranch}>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
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
        <Button variant="primary" disabled={pending}>
          {pending ? "Guardando…" : "Guardar"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button>
      </div>
    </form>
  );
}
