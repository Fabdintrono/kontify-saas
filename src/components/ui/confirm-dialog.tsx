"use client";
import { useRef, useState, useTransition, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { TriangleAlert } from "lucide-react";
import { useToast, type ToastInput } from "@/components/ui/toast";
import { GENERIC_ERROR, isRedirectError, type ActionResult } from "@/lib/action-result";

/** Confirmación antes de una acción irreversible. Reemplaza <form action={…}> + botón directo.
 *  - `action` es una Server Action (fd: FormData) => Promise<ActionResult>; `payload` son sus campos ocultos.
 *  - Nunca usar confirm() nativo: la PWA lo suprime en silencio. */
export function ConfirmDialog({ action, payload, title, description, confirmLabel, tone = "danger", successToast, triggerClassName, children }: {
  action: (fd: FormData) => Promise<ActionResult>; payload: Record<string, string>;
  title: string; description: string; confirmLabel: string; tone?: "danger" | "primary";
  successToast?: ToastInput; triggerClassName?: string; children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const { toast } = useToast();
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  function fail(description: string) {
    // El diálogo sigue abierto: el usuario ve el aviso y puede reintentar o cancelar.
    toast({ title: "No se pudo completar la acción", description, tone: "error" });
  }

  function confirm() {
    const fd = new FormData();
    for (const [k, v] of Object.entries(payload)) fd.append(k, v);
    start(async () => {
      try {
        const r = await action(fd);
        if (r && "error" in r) { fail(r.error); return; }
        if (successToast) toast(successToast);
        setOpen(false);
      } catch (e) {
        if (isRedirectError(e)) return; // navegando: el destino muestra su propio aviso
        // En producción React reemplaza el mensaje del servidor por un texto en inglés: no se usa.
        fail(GENERIC_ERROR);
      }
    });
  }

  const confirmCls = tone === "danger"
    ? "bg-[#dc2626] text-white hover:bg-[#b91c1c]"
    : "bg-[#0e7490] text-white hover:bg-[#0c6178]";

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!pending) setOpen(o); }}>
      <Dialog.Trigger asChild><button ref={triggerRef} type="button" className={triggerClassName}>{children}</button></Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content
          // Si la acción reemplazó al disparador (archivar deja «Reactivar»), Radix no tiene dónde
          // devolver el foco: va al <main tabIndex={-1}> en vez de perderse en el <body>.
          onCloseAutoFocus={(e) => {
            if (triggerRef.current && document.contains(triggerRef.current)) return;
            e.preventDefault();
            document.querySelector("main")?.focus();
          }}
          className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl">
          <div className="flex items-start gap-3">
            <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${tone === "danger" ? "bg-[#dc2626]/10 text-[#dc2626]" : "bg-[#0e7490]/10 text-[#0e7490]"}`}>
              <TriangleAlert className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <Dialog.Title className="break-words text-base font-bold text-[var(--text)]">{title}</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-[var(--text-soft)]">{description}</Dialog.Description>
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Dialog.Close asChild>
              <button type="button" disabled={pending} className="rounded-[10px] border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text)] disabled:opacity-60">Cancelar</button>
            </Dialog.Close>
            <button type="button" onClick={confirm} disabled={pending} aria-busy={pending} className={`rounded-[10px] px-4 py-2 text-sm font-semibold disabled:opacity-60 ${confirmCls}`}>
              {pending ? "Procesando…" : confirmLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
