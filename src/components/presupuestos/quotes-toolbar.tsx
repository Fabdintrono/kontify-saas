"use client";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

export function QuotesToolbar() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value); else next.delete(key);
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  }

  const sel = "h-9 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 text-sm text-[var(--text)]";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex h-9 min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-[var(--text-soft)]">
        <Search className="h-4 w-4" strokeWidth={2} />
        <input defaultValue={sp.get("q") ?? ""} placeholder="Buscar por número o cliente…"
          onKeyDown={(e) => { if (e.key === "Enter") setParam("q", (e.target as HTMLInputElement).value); }}
          className="w-full bg-transparent text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-soft)]" />
      </div>
      <select className={sel} defaultValue={sp.get("status") ?? "todos"} onChange={(e) => setParam("status", e.target.value)}>
        <option value="todos">Todos los estados</option>
        <option value="borradores">Borradores</option>
        <option value="enviados">Enviados</option>
        <option value="aceptados">Aceptados</option>
        <option value="rechazados">Rechazados</option>
        <option value="convertidos">Convertidos</option>
      </select>
    </div>
  );
}
