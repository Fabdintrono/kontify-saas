import { StatusBadge } from "@/components/ui/status-badge";

export function CategoryBadge({ name }: { name: string | null }) {
  if (!name) return <span className="text-xs text-[var(--text-soft)]">—</span>;
  return <StatusBadge tone="info" label={name} />;
}
