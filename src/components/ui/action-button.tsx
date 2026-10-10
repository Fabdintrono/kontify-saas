"use client";
import { useTransition, type ReactNode } from "react";
import { useToast, type ToastInput } from "@/components/ui/toast";

/** Acción de un clic que no necesita confirmación (reactivar, marcar aceptado) pero sí avisar
 *  de que pasó algo. Equivale a <form action={…}> + <PendingButton>, con toast al terminar.
 *  Usar ConfirmDialog cuando la acción sea destructiva o irreversible. */
export function ActionButton({ action, payload, successToast, className, children }: {
  action: (fd: FormData) => Promise<void>; payload: Record<string, string>;
  successToast?: ToastInput; className?: string; children: ReactNode;
}) {
  const [pending, start] = useTransition();
  const { toast } = useToast();

  function run() {
    const fd = new FormData();
    for (const [k, v] of Object.entries(payload)) fd.append(k, v);
    start(async () => {
      try {
        await action(fd);
      } catch (e) {
        toast({ title: "No se pudo completar la acción", description: (e as Error).message, tone: "error" });
        return;
      }
      if (successToast) toast(successToast);
    });
  }

  return (
    <button type="button" onClick={run} disabled={pending} className={className}>
      {pending ? "…" : children}
    </button>
  );
}
