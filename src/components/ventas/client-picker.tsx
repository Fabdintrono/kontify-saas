"use client";
import { useState } from "react";

export type LiteClient = { id: string; name: string };

export function ClientPicker({ clients, value, onChange }: {
  clients: LiteClient[]; value: string | null; onChange: (id: string | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const selected = clients.find((c) => c.id === value);
  const matches = query.trim()
    ? clients.filter((c) => c.name.toLowerCase().includes(query.toLowerCase())).slice(0, 8)
    : clients.slice(0, 8);
  const inputCls = "w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[#0e7490]";

  return (
    <div className="relative">
      <input className={inputCls} placeholder="Consumidor final"
        value={open ? query : (selected?.name ?? "")}
        onFocus={() => { setOpen(true); setQuery(""); }}
        onChange={(e) => setQuery(e.target.value)}
        onBlur={() => setTimeout(() => setOpen(false), 150)} />
      {open && (
        <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-[10px] border border-[var(--border)] bg-[var(--surface)] shadow-lg">
          <li><button type="button" onMouseDown={(e) => { e.preventDefault(); onChange(null); setOpen(false); }}
            className="block w-full px-3 py-2 text-left text-sm text-[var(--text-soft)] hover:bg-[var(--bg)]">Consumidor final</button></li>
          {matches.map((c) => (
            <li key={c.id}><button type="button" onMouseDown={(e) => { e.preventDefault(); onChange(c.id); setOpen(false); }}
              className="block w-full px-3 py-2 text-left text-sm text-[var(--text)] hover:bg-[var(--bg)]">{c.name}</button></li>
          ))}
        </ul>
      )}
    </div>
  );
}
