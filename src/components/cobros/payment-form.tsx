"use client";
import { useActionState, useEffect, useState } from "react";
import { registerPaymentAction, type FormState } from "@/app/(app)/finanzas/cuentas-por-cobrar/actions";
import { formatMoney } from "@/lib/format";

const initial: FormState = { ok: false };
const inputCls = "w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[#0e7490]";
const labelCls = "mb-1 block text-xs font-medium text-[var(--text-soft)]";

export function PaymentForm({ saleId, balance, currency }: { saleId: string; balance: number; currency: string }) {
  const [state, formAction, pending] = useActionState(registerPaymentAction, initial);
  const [open, setOpen] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const err = (k: string) => state.fieldErrors?.[k];

  // Tras un abono exitoso, colapsa el panel; el revalidatePath ya refrescó saldo/historial.
  useEffect(() => { if (state.ok) setOpen(false); }, [state]);

  if (!open) return (
    <button type="button" onClick={() => setOpen(true)}
      className="rounded-[10px] bg-gradient-to-br from-[#0e7490] to-[#14b8a6] px-3 py-2 text-sm font-semibold text-white">
      Registrar abono
    </button>
  );

  return (
    <form action={formAction} className="max-w-md space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <input type="hidden" name="saleId" value={saleId} />
      <p className="text-sm font-bold text-[var(--text)]">Registrar abono — saldo {formatMoney(balance, currency)}</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Monto</label>
          <input name="amount" type="number" step="0.01" min="0" max={balance} defaultValue={balance} className={inputCls} />
          {err("amount") && <p className="mt-1 text-xs text-[#dc2626]">{err("amount")}</p>}
        </div>
        <div>
          <label className={labelCls}>Fecha</label>
          <input name="paidAt" type="date" defaultValue={today} max={today} className={inputCls} />
          {err("paidAt") && <p className="mt-1 text-xs text-[#dc2626]">{err("paidAt")}</p>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={labelCls}>Método</label><input name="method" className={inputCls} placeholder="Efectivo, transferencia…" /></div>
        <div><label className={labelCls}>Referencia</label><input name="reference" className={inputCls} placeholder="Nº comprobante" /></div>
      </div>
      <div><label className={labelCls}>Notas</label><input name="notes" className={inputCls} /></div>
      {state.error && <p className="text-sm text-[#dc2626]">{state.error}</p>}
      <div className="flex gap-2">
        <button disabled={pending} className="rounded-[10px] bg-gradient-to-br from-[#0e7490] to-[#14b8a6] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
          {pending ? "Guardando…" : "Guardar abono"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-[10px] border border-[var(--border)] px-4 py-2.5 text-sm text-[var(--text)]">Cancelar</button>
      </div>
    </form>
  );
}
