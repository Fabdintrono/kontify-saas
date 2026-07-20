"use client";
import * as PO from "@radix-ui/react-popover";
import type { ReactNode } from "react";

export function Popover({ trigger, children, align = "end" }: {
  trigger: ReactNode; children: ReactNode; align?: "start" | "center" | "end";
}) {
  return (
    <PO.Root>
      <PO.Trigger asChild>{trigger}</PO.Trigger>
      <PO.Portal>
        <PO.Content align={align} sideOffset={8}
          className="z-50 w-80 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-lg">
          {children}
        </PO.Content>
      </PO.Portal>
    </PO.Root>
  );
}
