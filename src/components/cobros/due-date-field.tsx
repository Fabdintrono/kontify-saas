"use client";
import { useTransition } from "react";
import { setDueDateAction } from "@/app/(app)/finanzas/cuentas-por-cobrar/actions";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { GENERIC_ERROR, isRedirectError } from "@/lib/action-result";
import { flashFor } from "@/lib/flash";
import { formatDateOnly } from "@/lib/format";

export function DueDateField({ saleId, dueDate, canEdit }: { saleId: string; dueDate: string | null; canEdit: boolean }) {
  const [pending, start] = useTransition();
  const { toast } = useToast();
  const inputCls = "h-10 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text)] outline-none focus:border-[#0e7490]";

  function fail(description: string) {
    toast({ title: "No se pudo guardar el vencimiento", description, tone: "error" });
  }

  function save(fd: FormData) {
    start(async () => {
      try {
        const r = await setDueDateAction(fd);
        if (r && "error" in r) { fail(r.error); return; }
        toast(flashFor("vencimiento-guardado"));
      } catch (e) {
        if (isRedirectError(e)) return; // navegando: el destino muestra su propio aviso
        // En producción React reemplaza el mensaje del servidor por un texto en inglés: no se usa.
        fail(GENERIC_ERROR);
      }
    });
  }

  if (!canEdit) return (
    <p className="text-sm"><span className="text-[var(--text-soft)]">Vencimiento: </span>
      <span className="text-[var(--text)]">{formatDateOnly(dueDate)}</span></p>
  );
  return (
    <form className="flex items-center gap-2"
      onSubmit={(e) => { e.preventDefault(); save(new FormData(e.currentTarget)); }}>
      <input type="hidden" name="saleId" value={saleId} />
      <label htmlFor={`due-${saleId}`} className="text-sm text-[var(--text-soft)]">Vencimiento</label>
      <input id={`due-${saleId}`} type="date" name="dueDate" defaultValue={dueDate ?? ""} className={inputCls} />
      <Button variant="secondary" disabled={pending}>{pending ? "Guardando…" : "Guardar"}</Button>
    </form>
  );
}
