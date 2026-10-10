"use client";
import { useActionState, useEffect, useState } from "react";
import { registerPaymentAction, type FormState } from "@/app/(app)/finanzas/cuentas-por-cobrar/actions";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { flashFor } from "@/lib/flash";
import { formatMoney } from "@/lib/format";

const initial: FormState = { ok: false };
const inputCls = "w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[#0e7490]";
const labelCls = "mb-1 block text-xs font-medium text-[var(--text-soft)]";

export function PaymentForm({ saleId, balance, currency, today }: { saleId: string; balance: number; currency: string; today: string }) {
  const [state, formAction, pending] = useActionState(registerPaymentAction, initial);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const err = (k: string) => state.fieldErrors?.[k];

  // Tras un abono exitoso, colapsa el panel y avisa; el revalidatePath ya refrescó saldo/historial.
  useEffect(() => { if (state.ok) { setOpen(false); toast(flashFor("abono-registrado")); } }, [state]);

  if (!open) return (
    <Button type="button" variant="primary" onClick={() => setOpen(true)}>
      Registrar abono
    </Button>
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
        <Button variant="primary" disabled={pending}>
          {pending ? "Guardando…" : "Guardar abono"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button>
      </div>
    </form>
  );
}
