"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { CircleCheck, TriangleAlert, X } from "lucide-react";

export type ToastInput = { title: string; description?: string; tone?: "success" | "error"; href?: string; hrefLabel?: string };
type Toast = ToastInput & { id: number };
type Ctx = { toast: (t: ToastInput) => void };

const ToastCtx = createContext<Ctx | null>(null);
const DURATION_MS = 4000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const seq = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const t = timers.current.get(id);
    if (t) { clearTimeout(t); timers.current.delete(id); }
    setItems((xs) => xs.filter((x) => x.id !== id));
  }, []);

  const toast = useCallback((t: ToastInput) => {
    const id = ++seq.current;
    setItems((xs) => [...xs.slice(-2), { ...t, id }]); // máximo 3 visibles
    // No se van solos: el aviso con enlace (hay que poder pulsar «Ver») ni el de error.
    if (!t.href && t.tone !== "error") timers.current.set(id, setTimeout(() => dismiss(id), DURATION_MS));
  }, [dismiss]);

  // Al desmontar, ningún temporizador queda vivo tocando estado de un árbol que ya no existe.
  useEffect(() => () => {
    for (const t of timers.current.values()) clearTimeout(t);
    timers.current.clear();
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  const item = (t: Toast) => (
    <div key={t.id}
      className="pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-sm shadow-lg">
      {t.tone === "error"
        ? <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#dc2626]" strokeWidth={2} aria-hidden="true" />
        : <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#0f766e] dark:text-[#6ee7b7]" strokeWidth={2} aria-hidden="true" />}
      <div className="min-w-0 flex-1">
        <p className="break-words font-semibold text-[var(--text)]">{t.title}</p>
        {t.description && <p className="break-words text-xs text-[var(--text-soft)]">{t.description}</p>}
        {t.href && <Link href={t.href} onClick={() => dismiss(t.id)} className="mt-1 inline-block text-xs font-semibold text-[#0e7490] dark:text-[#5eead4]">{t.hrefLabel ?? "Ver"}</Link>}
      </div>
      <button type="button" aria-label="Cerrar aviso" onClick={() => dismiss(t.id)}
        className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-[var(--text-soft)] hover:bg-[var(--bg)]">
        <X className="h-3.5 w-3.5" strokeWidth={2} />
      </button>
    </div>
  );

  // Dos regiones vivas hermanas en la misma pila: el lector de pantalla interrumpe por un error
  // (assertive) y espera una pausa para un éxito (polite). Mezclarlos en una sola región obliga
  // a elegir un solo tono para todo. Las dos se renderizan siempre, aunque estén vacías: una
  // región que aparece junto con su contenido no se anuncia. Vacías miden 0 y no se ven.
  const region = "flex w-full flex-col items-center gap-2 lg:w-auto lg:items-end";
  return (
    <ToastCtx.Provider value={value}>
      {children}
      {/* lg:bottom-24 deja libre el FAB de Vender (bottom-6 right-6). */}
      <div className="pointer-events-none fixed inset-x-3 bottom-20 z-[60] flex flex-col items-center gap-2 lg:inset-x-auto lg:bottom-24 lg:right-6 lg:items-end">
        <div aria-live="polite" data-toast-region="polite" className={region}>
          {items.filter((t) => t.tone !== "error").map(item)}
        </div>
        <div aria-live="assertive" data-toast-region="assertive" className={region}>
          {items.filter((t) => t.tone === "error").map(item)}
        </div>
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast(): Ctx {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast debe usarse dentro de <ToastProvider>");
  return ctx;
}
