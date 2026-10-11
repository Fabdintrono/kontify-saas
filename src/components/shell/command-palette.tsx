"use client";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import { Search, CornerDownLeft, Users, Package, ShoppingCart, ArrowRight } from "lucide-react";
import { searchEverything, type Hit } from "@/lib/search/actions";
import { quickActionsFor } from "@/lib/dashboard/quick-actions";
import { navForRole, configForRole } from "@/lib/nav";
import type { Role } from "@/lib/auth/roles";

type Item = { id: string; title: string; subtitle: string; href: string; group: string; icon: typeof Users };

const ICONO_HIT = { cliente: Users, producto: Package, venta: ShoppingCart } as const;
const DEBOUNCE_MS = 200;

/** Buscador y lanzador de acciones. Se abre con Ctrl+K o con «/».
 *
 *  Sin resultados escritos muestra lo que se hace a diario y todas las pantallas, así
 *  que también sirve de mapa para quien aún no conoce el menú. Escribiendo busca
 *  clientes, productos y el número de una venta.
 *
 *  Sin animación de apertura: es la acción más repetida del día y cualquier retardo
 *  se nota. El contenido sí se desvanece al cambiar, para que no parpadee. */
export function CommandPalette({ role, open, onOpenChange }: {
  role: Role; open: boolean; onOpenChange: (o: boolean) => void;
}) {
  const router = useRouter();
  const [term, setTerm] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [activo, setActivo] = useState(0);
  const [buscando, start] = useTransition();
  const listRef = useRef<HTMLUListElement>(null);
  const pedido = useRef(0);

  // Destinos fijos: las acciones del día y todas las pantallas a las que llega este rol.
  const fijos: Item[] = useMemo(() => {
    const acciones = quickActionsFor(role).map((a) => ({
      id: `accion-${a.key}`, title: a.label, subtitle: a.hint, href: a.href,
      group: "Crear", icon: a.icon,
    }));
    const config = configForRole(role);
    const secciones = [...navForRole(role), ...(config ? [config] : [])];
    const pantallas = secciones.flatMap((s) => s.children.map((c) => ({
      id: `nav-${c.href}`, title: c.label,
      subtitle: c.pronto ? `${s.label} · llega pronto` : s.label,
      href: c.href, group: "Ir a", icon: c.icon,
    })));
    return [...acciones, ...pantallas];
  }, [role]);

  const filtrados: Item[] = useMemo(() => {
    const t = term.trim().toLowerCase();
    if (!t) return fijos;
    const porTexto = fijos.filter((f) =>
      f.title.toLowerCase().includes(t) || f.subtitle.toLowerCase().includes(t));
    const deDatos: Item[] = hits.map((h) => ({
      id: `${h.kind}-${h.id}`, title: h.title, subtitle: h.subtitle, href: h.href,
      group: h.kind === "cliente" ? "Clientes" : h.kind === "producto" ? "Productos" : "Ventas",
      icon: ICONO_HIT[h.kind],
    }));
    return [...deDatos, ...porTexto];
  }, [term, fijos, hits]);

  // Al abrir se limpia: el buscador siempre empieza en blanco, como una hoja nueva.
  useEffect(() => { if (open) { setTerm(""); setHits([]); setActivo(0); } }, [open]);

  useEffect(() => {
    const t = term.trim();
    if (t.length < 2) { setHits([]); return; }
    const id = ++pedido.current;
    const timer = setTimeout(() => {
      start(async () => {
        const r = await searchEverything(t);
        // Una respuesta vieja que llega tarde no debe pisar a la última.
        if (id === pedido.current) { setHits(r); setActivo(0); }
      });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [term]);

  useEffect(() => { setActivo((a) => Math.min(a, Math.max(0, filtrados.length - 1))); }, [filtrados.length]);

  // La fila activa se mantiene a la vista al moverse con las flechas.
  // `scrollIntoView` no existe en todos los entornos: si falta, moverse sigue funcionando.
  useEffect(() => {
    const fila = listRef.current?.querySelector('[data-activo="true"]');
    if (fila && typeof (fila as HTMLElement).scrollIntoView === "function") {
      (fila as HTMLElement).scrollIntoView({ block: "nearest" });
    }
  }, [activo]);

  function ir(item: Item) { onOpenChange(false); router.push(item.href); }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActivo((a) => (a + 1) % Math.max(1, filtrados.length)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActivo((a) => (a - 1 + filtrados.length) % Math.max(1, filtrados.length)); }
    else if (e.key === "Enter" && filtrados[activo]) { e.preventDefault(); ir(filtrados[activo]); }
  }

  let grupoAnterior = "";

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-[12vh] z-50 w-[92vw] max-w-xl -translate-x-1/2 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl">
          <Dialog.Title className="sr-only">Buscar en Kontify</Dialog.Title>

          <div className="flex items-center gap-2.5 border-b border-[var(--border)] px-4">
            <Search className="h-4 w-4 shrink-0 text-[var(--text-soft)]" strokeWidth={2} aria-hidden="true" />
            <label htmlFor="buscador-global" className="sr-only">Buscar un cliente, un producto o el número de una venta</label>
            <input id="buscador-global" autoFocus value={term} onChange={(e) => setTerm(e.target.value)}
              onKeyDown={onKeyDown} role="combobox" aria-expanded aria-controls="resultados-busqueda"
              aria-activedescendant={filtrados[activo] ? `op-${filtrados[activo].id}` : undefined}
              placeholder="Busca un cliente, un producto o el número de una venta"
              className="h-14 w-full bg-transparent text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-soft)]" />
            {buscando && <span className="shrink-0 text-xs text-[var(--text-soft)]">Buscando</span>}
          </div>

          <ul ref={listRef} id="resultados-busqueda" role="listbox" aria-label="Resultados"
            className="max-h-[52vh] overflow-y-auto p-1.5">
            {filtrados.length === 0 && (
              <li className="px-3 py-8 text-center text-sm text-[var(--text-soft)]">
                {term.trim().length < 2
                  ? "Escribe al menos dos letras."
                  : <>Nada con «{term.trim()}». Prueba con otro nombre o con el número de la venta.</>}
              </li>
            )}
            {filtrados.map((item, i) => {
              const nuevoGrupo = item.group !== grupoAnterior;
              grupoAnterior = item.group;
              const Icon = item.icon;
              const on = i === activo;
              return (
                <li key={item.id}>
                  {nuevoGrupo && (
                    <p className="px-3 pb-1 pt-3 text-[11px] font-bold uppercase tracking-wide text-[var(--text-soft)]">{item.group}</p>
                  )}
                  <button type="button" id={`op-${item.id}`} role="option" aria-selected={on} data-activo={on}
                    onMouseMove={() => setActivo(i)} onClick={() => ir(item)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors duration-100 ${
                      on ? "bg-[var(--bg)]" : ""}`}>
                    <Icon className="h-4 w-4 shrink-0 text-[var(--text-soft)]" strokeWidth={2} aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-[var(--text)]">{item.title}</span>
                      <span className="block truncate text-xs text-[var(--text-soft)]">{item.subtitle}</span>
                    </span>
                    {on && <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[var(--text-soft)]" strokeWidth={2.5} aria-hidden="true" />}
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] px-4 py-2 text-[11px] text-[var(--text-soft)]">
            <span className="flex items-center gap-1.5">
              <Tecla>↑</Tecla><Tecla>↓</Tecla> moverse
              <Tecla><CornerDownLeft className="h-3 w-3" aria-hidden="true" /></Tecla> abrir
            </span>
            <span className="flex items-center gap-1.5"><Tecla>Esc</Tecla> cerrar</span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Tecla({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-grid h-5 min-w-5 place-items-center rounded border border-[var(--border)] bg-[var(--bg)] px-1 font-mono text-[10px]">
      {children}
    </kbd>
  );
}
