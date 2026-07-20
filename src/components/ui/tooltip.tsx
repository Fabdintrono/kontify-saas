"use client";
import * as TP from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";

export function Tooltip({ label, children, side = "right" }: {
  label: string; children: ReactNode; side?: "top" | "right" | "bottom" | "left";
}) {
  return (
    <TP.Provider delayDuration={200}>
      <TP.Root>
        <TP.Trigger asChild>{children}</TP.Trigger>
        <TP.Portal>
          <TP.Content side={side} sideOffset={8}
            className="z-50 rounded-md bg-[#0f172a] px-2 py-1 text-xs font-medium text-white shadow-md">
            {label}
            <TP.Arrow className="fill-[#0f172a]" />
          </TP.Content>
        </TP.Portal>
      </TP.Root>
    </TP.Provider>
  );
}
