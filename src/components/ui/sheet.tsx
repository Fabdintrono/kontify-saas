"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

export function Sheet({ open, onOpenChange, side = "bottom", title, children }: {
  open: boolean; onOpenChange: (o: boolean) => void; side?: "bottom" | "right";
  title: string; children: ReactNode;
}) {
  const pos = side === "bottom"
    ? "inset-x-0 bottom-0 max-h-[85vh] rounded-t-2xl data-[state=open]:animate-slide-up-in data-[state=closed]:animate-slide-up-out"
    : "inset-y-0 right-0 w-[88vw] max-w-sm rounded-l-2xl data-[state=open]:animate-slide-right-in data-[state=closed]:animate-slide-right-out";
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out" />
        <Dialog.Content
          className={`fixed z-50 overflow-y-auto border border-[var(--border)] bg-[var(--surface)] p-4 ${pos}`}>
          <Dialog.Close asChild>
            <button type="button" aria-label="Cerrar"
              className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-lg text-[var(--text-soft)] transition-colors hover:bg-[var(--bg)]">
              <X className="h-4 w-4" strokeWidth={2} />
            </button>
          </Dialog.Close>
          <Dialog.Title className="mb-3 pr-10 text-base font-bold text-[var(--text)]">{title}</Dialog.Title>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
