"use client";
import * as DM from "@radix-ui/react-dropdown-menu";
import type { ReactNode } from "react";

export function DropdownMenu({ trigger, children, align = "end" }: {
  trigger: ReactNode; children: ReactNode; align?: "start" | "center" | "end";
}) {
  return (
    <DM.Root>
      <DM.Trigger asChild>{trigger}</DM.Trigger>
      <DM.Portal>
        <DM.Content align={align} sideOffset={8}
          className="z-50 min-w-52 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-lg">
          {children}
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  );
}

export function DropdownItem({ children, onSelect }: { children: ReactNode; onSelect?: () => void }) {
  return (
    <DM.Item onSelect={onSelect}
      className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-[var(--text)] outline-none data-[highlighted]:bg-[var(--bg)]">
      {children}
    </DM.Item>
  );
}

export function DropdownLabel({ children }: { children: ReactNode }) {
  return <DM.Label className="px-2.5 py-1.5 text-xs font-semibold text-[var(--text-soft)]">{children}</DM.Label>;
}

export function DropdownSeparator() {
  return <DM.Separator className="my-1 h-px bg-[var(--border)]" />;
}
