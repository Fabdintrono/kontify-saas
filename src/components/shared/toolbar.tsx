"use client";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

const DEBOUNCE_MS = 300;

/** Lo común de las seis barras de filtro: escribe en la URL, borra la página al cambiar
 *  cualquier criterio y mantiene un estado de «navegando» para atenuar lo que haya debajo. */
export function useFilterParams() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value); else next.delete(key);
    next.delete("page");
    start(() => router.push(`${pathname}?${next.toString()}`));
  }

  return { sp, pending, setParam };
}

/** Envoltura de la barra. Mientras navega marca `aria-busy` y baja la opacidad:
 *  el usuario ve que su filtro se está aplicando. */
export function Toolbar({ pending, children }: { pending: boolean; children: ReactNode }) {
  return (
    <div aria-busy={pending || undefined}
      className={`flex flex-wrap items-center gap-2 transition-opacity ${pending ? "opacity-60" : ""}`}>
      {children}
    </div>
  );
}

export const TOOLBAR_SELECT =
  "h-9 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 text-sm text-[var(--text)] transition-colors focus:border-[#0e7490] focus:outline-none";

/** Buscador con rebote de 300 ms: busca mientras se escribe, sin disparar una consulta
 *  por tecla. Enter sigue funcionando para quien lo espera. */
export function SearchField({ label, placeholder, value, onSearch }: {
  label: string; placeholder: string; value: string; onSearch: (v: string) => void;
}) {
  const [text, setText] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const last = useRef(value);

  // Si la URL cambia por otra vía (atrás, un enlace), el campo la sigue.
  useEffect(() => { setText(value); last.current = value; }, [value]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function schedule(v: string) {
    setText(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (v === last.current) return; // nada que buscar: el término no cambió
      last.current = v;
      onSearch(v);
    }, DEBOUNCE_MS);
  }

  function now() {
    if (timer.current) clearTimeout(timer.current);
    if (text === last.current) return;
    last.current = text;
    onSearch(text);
  }

  const id = `buscar-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div className="flex h-9 min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-[var(--text-soft)] transition-colors focus-within:border-[#0e7490]">
      <Search className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
      <label htmlFor={id} className="sr-only">{label}</label>
      <input id={id} type="search" value={text} placeholder={placeholder}
        onChange={(e) => schedule(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); now(); } }}
        className="w-full bg-transparent text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-soft)]" />
    </div>
  );
}
