"use client";
import { useTransition } from "react";
import { setDueDateAction } from "@/app/(app)/finanzas/cuentas-por-cobrar/actions";
import { useToast } from "@/components/ui/toast";
import { flashFor } from "@/lib/flash";
import { formatDateOnly } from "@/lib/format";

export function DueDateField({ saleId, dueDate, canEdit }: { saleId: string; dueDate: string | null; canEdit: boolean }) {
  const [pending, start] = useTransition();
  const { toast } = useToast();
  const inputCls = "h-9 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text)] outline-none focus:border-[#0e7490]";
  if (!canEdit) return (
    <p className="text-sm"><span className="text-[var(--text-soft)]">Vencimiento: </span>
      <span className="text-[var(--text)]">{formatDateOnly(dueDate)}</span></p>
  );
  return (
    <form className="flex items-center gap-2"
      onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); start(async () => { try { await setDueDateAction(fd); toast(flashFor("vencimiento-guardado")); } catch { toast({ title: "No se pudo guardar el vencimiento", tone: "error" }); } }); }}>
      <input type="hidden" name="saleId" value={saleId} />
      <label htmlFor={`due-${saleId}`} className="text-sm text-[var(--text-soft)]">Vencimiento</label>
      <input id={`due-${saleId}`} type="date" name="dueDate" defaultValue={dueDate ?? ""} className={inputCls} />
      <button disabled={pending} className="rounded-[10px] border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--text)] disabled:opacity-60">{pending ? "Guardando…" : "Guardar"}</button>
    </form>
  );
}
