import type { LucideIcon } from "lucide-react";

export function EmptyState({ icon: Icon, title, hint }: { icon: LucideIcon; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <div className="grid h-11 w-11 place-items-center rounded-xl border border-[var(--border)] bg-[var(--bg)]">
        <Icon className="h-5 w-5 text-[var(--text-soft)]" strokeWidth={2} />
      </div>
      <p className="text-sm font-semibold text-[var(--text)]">{title}</p>
      {hint && <p className="text-xs text-[var(--text-soft)]">{hint}</p>}
    </div>
  );
}
