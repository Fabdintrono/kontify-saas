import { setDueDateAction } from "@/app/(app)/finanzas/cuentas-por-cobrar/actions";

export function DueDateField({ saleId, dueDate, canEdit }: { saleId: string; dueDate: string | null; canEdit: boolean }) {
  const inputCls = "h-9 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text)] outline-none focus:border-[#0e7490]";
  if (!canEdit) return (
    <p className="text-sm"><span className="text-[var(--text-soft)]">Vencimiento: </span>
      <span className="text-[var(--text)]">{dueDate ? new Date(dueDate).toLocaleDateString("es-VE") : "—"}</span></p>
  );
  return (
    <form action={setDueDateAction} className="flex items-center gap-2">
      <input type="hidden" name="saleId" value={saleId} />
      <label className="text-sm text-[var(--text-soft)]">Vencimiento</label>
      <input type="date" name="dueDate" defaultValue={dueDate ?? ""} className={inputCls} />
      <button className="rounded-[10px] border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--text)]">Guardar</button>
    </form>
  );
}
