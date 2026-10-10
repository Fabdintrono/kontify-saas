"use client";
import { useTransition, type ReactNode } from "react";
import { useToast, type ToastInput } from "@/components/ui/toast";
import { GENERIC_ERROR, isRedirectError, type ActionResult } from "@/lib/action-result";

/** Acción de un clic que no necesita confirmación (reactivar, marcar aceptado) pero sí avisar
 *  de que pasó algo. Equivale a <form action={…}> + <PendingButton>, con toast al terminar.
 *  Usar ConfirmDialog cuando la acción sea destructiva o irreversible. */
export function ActionButton({ action, payload, successToast, pendingLabel = "…", className, children }: {
  action: (fd: FormData) => Promise<ActionResult>; payload: Record<string, string>;
  successToast?: ToastInput; pendingLabel?: string; className?: string; children: ReactNode;
}) {
  const [pending, start] = useTransition();
  const { toast } = useToast();

  function fail(description: string) {
    toast({ title: "No se pudo completar la acción", description, tone: "error" });
  }

  function run() {
    const fd = new FormData();
    for (const [k, v] of Object.entries(payload)) fd.append(k, v);
    start(async () => {
      try {
        const r = await action(fd);
        if (r && "error" in r) { fail(r.error); return; }
        if (successToast) toast(successToast);
      } catch (e) {
        if (isRedirectError(e)) return; // navegando: el destino muestra su propio aviso
        // En producción React reemplaza el mensaje del servidor por un texto en inglés: no se usa.
        fail(GENERIC_ERROR);
      }
    });
  }

  return (
    <button type="button" onClick={run} disabled={pending} aria-busy={pending} className={className}>
      {pending ? pendingLabel : children}
    </button>
  );
}
