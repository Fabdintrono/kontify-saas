export function TypeBadge({ name }: { name: string | null }) {
  if (!name) return <span className="text-xs text-[var(--text-soft)]">—</span>;
  return (
    <span className="inline-flex items-center rounded-full bg-[#0e7490]/10 px-2 py-0.5 text-xs font-medium text-[#0e7490] dark:text-[#5eead4]">
      {name}
    </span>
  );
}
