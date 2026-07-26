const MAP: Record<string, { label: string; cls: string }> = {
  draft:  { label: "Borrador", cls: "bg-[var(--bg)] text-[var(--text-soft)]" },
  issued: { label: "Emitida",  cls: "bg-[#0e7490]/10 text-[#0e7490] dark:text-[#5eead4]" },
  void:   { label: "Anulada",  cls: "bg-[#dc2626]/10 text-[#dc2626]" },
};

export function SaleStatusBadge({ status }: { status: string }) {
  const s = MAP[status] ?? { label: status, cls: "bg-[var(--bg)] text-[var(--text-soft)]" };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span>;
}
