import type { StockStatus } from "@/lib/inventario/queries";

const MAP: Record<StockStatus, { label: string; cls: string }> = {
  en_stock: { label: "En stock", cls: "bg-[#0e7490]/10 text-[#0e7490] dark:text-[#5eead4]" },
  bajo:     { label: "Bajo",     cls: "bg-[#f59e0b]/15 text-[#b45309] dark:text-[#fbbf24]" },
  agotado:  { label: "Agotado",  cls: "bg-[#dc2626]/10 text-[#dc2626]" },
};

export function StockStatusBadge({ status }: { status: StockStatus }) {
  const s = MAP[status] ?? MAP.en_stock;
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span>;
}
