"use client";
import { useState } from "react";

export type LiteProduct = { id: string; name: string; price: number; unit: string; taxRate: number };

export function ProductPicker({ products, onPick }: { products: LiteProduct[]; onPick: (p: LiteProduct) => void }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const matches = query.trim()
    ? products.filter((p) => p.name.toLowerCase().includes(query.toLowerCase())).slice(0, 8)
    : products.slice(0, 8);
  const inputCls = "w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[#0e7490]";

  return (
    <div className="relative">
      <input className={inputCls} placeholder="Agregar producto…" value={query}
        onFocus={() => setOpen(true)} onChange={(e) => setQuery(e.target.value)}
        onBlur={() => setTimeout(() => setOpen(false), 150)} />
      {open && matches.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-[10px] border border-[var(--border)] bg-[var(--surface)] shadow-lg">
          {matches.map((p) => (
            <li key={p.id}><button type="button"
              onMouseDown={(e) => { e.preventDefault(); onPick(p); setQuery(""); setOpen(false); }}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-[var(--text)] hover:bg-[var(--bg)]">
              <span>{p.name}</span><span className="text-xs text-[var(--text-soft)]">{p.price}</span>
            </button></li>
          ))}
        </ul>
      )}
    </div>
  );
}
