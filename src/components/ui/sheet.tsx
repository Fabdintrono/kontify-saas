"use client";
import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";

export function Sheet({ open, onOpenChange, side = "bottom", title, children }: {
  open: boolean; onOpenChange: (o: boolean) => void; side?: "bottom" | "right";
  title: string; children: ReactNode;
}) {
  const pos = side === "bottom"
    ? "inset-x-0 bottom-0 max-h-[85vh] rounded-t-2xl"
    : "inset-y-0 right-0 w-[88vw] max-w-sm rounded-l-2xl";
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content
          className={`fixed z-50 overflow-y-auto border border-[var(--border)] bg-[var(--surface)] p-4 ${pos}`}>
          <Dialog.Title className="mb-3 text-base font-bold text-[var(--text)]">{title}</Dialog.Title>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
