"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sheet } from "@/components/ui/sheet";
import { quickActionsFor } from "@/lib/dashboard/quick-actions";
import type { Role } from "@/lib/auth/roles";

/** Un atajo no dispara si el usuario está escribiendo o si sostiene un modificador
 *  (Ctrl+C debe seguir copiando). */
function esTecleoLibre(e: KeyboardEvent): boolean {
  if (e.ctrlKey || e.metaKey || e.altKey) return false;
  const t = e.target as HTMLElement | null;
  if (!t) return true;
  const tag = t.tagName;
  return !(tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t.isContentEditable);
}

export const SHORTCUT_NAV = [
  { keys: "D", label: "Ir al inicio", href: "/dashboard" },
  { keys: "L", label: "Ir a Clientes", href: "/clientes" },
  { keys: "T", label: "Ir a Ventas", href: "/operaciones/facturacion" },
] as const;

/** Atajos de una tecla, activos en toda la app. Sin animación al navegar: una acción
 *  que se repite decenas de veces al día debe sentirse instantánea. */
export function KeyboardShortcuts({ role, onOpenSearch }: { role: Role; onOpenSearch: () => void }) {
  const router = useRouter();
  const [ayuda, setAyuda] = useState(false);
  const acciones = quickActionsFor(role);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Cmd/Ctrl+K abre el buscador aunque el foco esté en un campo: es la salida de emergencia.
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault(); onOpenSearch(); return;
      }
      if (!esTecleoLibre(e)) return;
      if (e.key === "/") { e.preventDefault(); onOpenSearch(); return; }
      if (e.key === "?") { e.preventDefault(); setAyuda((v) => !v); return; }

      const k = e.key.toUpperCase();
      const nav = SHORTCUT_NAV.find((n) => n.keys === k);
      if (nav) { e.preventDefault(); router.push(nav.href); return; }
      const accion = acciones.find((a) => a.shortcut === k);
      if (accion) { e.preventDefault(); router.push(accion.href); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, acciones, onOpenSearch]);

  return (
    <Sheet open={ayuda} onOpenChange={setAyuda} side="right" title="Atajos de teclado">
      <p className="mb-4 text-sm text-[var(--text-soft)]">
        Funcionan en cualquier pantalla, siempre que no estés escribiendo en un campo.
      </p>
      <Grupo titulo="Buscar">
        <Fila teclas={["Ctrl", "K"]} texto="Abrir el buscador" />
        <Fila teclas={["/"]} texto="Abrir el buscador" />
      </Grupo>
      <Grupo titulo="Ir a">
        {SHORTCUT_NAV.map((n) => <Fila key={n.keys} teclas={[n.keys]} texto={n.label} />)}
      </Grupo>
      {acciones.length > 0 && (
        <Grupo titulo="Crear">
          {acciones.map((a) => <Fila key={a.key} teclas={[a.shortcut]} texto={a.label} />)}
        </Grupo>
      )}
      <Grupo titulo="Esta ventana">
        <Fila teclas={["?"]} texto="Abrir y cerrar esta lista" />
        <Fila teclas={["Esc"]} texto="Cerrar lo que esté abierto" />
      </Grupo>
    </Sheet>
  );
}

function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-[var(--text-soft)]">{titulo}</p>
      <ul className="space-y-1">{children}</ul>
    </div>
  );
}

function Fila({ teclas, texto }: { teclas: string[]; texto: string }) {
  return (
    <li className="flex items-center justify-between gap-3 text-sm text-[var(--text)]">
      <span>{texto}</span>
      <span className="flex shrink-0 items-center gap-1">
        {teclas.map((t) => (
          <kbd key={t} className="grid h-6 min-w-6 place-items-center rounded-md border border-[var(--border)] bg-[var(--bg)] px-1.5 font-mono text-[11px] text-[var(--text-soft)]">{t}</kbd>
        ))}
      </span>
    </li>
  );
}
