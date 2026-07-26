const MAP: Record<string, { label: string; cls: string }> = {
  draft:     { label: "Borrador",  cls: "bg-[var(--bg)] text-[var(--text-soft)]" },
  sent:      { label: "Enviado",   cls: "bg-[#0e7490]/10 text-[#0e7490] dark:text-[#5eead4]" },
  accepted:  { label: "Aceptado",  cls: "bg-[#0f766e]/15 text-[#0f766e] dark:text-[#6ee7b7]" },
  rejected:  { label: "Rechazado", cls: "bg-[#dc2626]/10 text-[#dc2626]" },
  converted: { label: "Convertido", cls: "bg-[#7c3aed]/10 text-[#7c3aed] dark:text-[#c4b5fd]" },
};

export function QuoteStatusBadge({ status }: { status: string }) {
  const s = MAP[status] ?? { label: status, cls: "bg-[var(--bg)] text-[var(--text-soft)]" };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span>;
}
