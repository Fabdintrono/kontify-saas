import Link from "next/link";
import { quickActionsFor } from "@/lib/dashboard/quick-actions";
import type { Role } from "@/lib/auth/roles";

/** Lo que se hace a diario, a un clic desde el inicio.
 *
 *  No son tarjetas decoradas: son botones anchos con icono, verbo y una línea de qué
 *  resuelven, para que alguien que llega de una hoja de cálculo sepa por dónde empezar.
 *  Cada uno muestra su tecla, que funciona en cualquier pantalla de la app. */
export function QuickActions({ role }: { role: Role }) {
  const actions = quickActionsFor(role);
  if (actions.length === 0) return null;

  return (
    <section aria-labelledby="accesos-rapidos">
      <h2 id="accesos-rapidos" className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--text-soft)]">
        Qué quieres hacer
      </h2>
      <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {actions.map((a) => {
          const Icon = a.icon;
          return (
            <li key={a.key}>
              <Link href={a.href}
                className="group flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 transition-[border-color,transform] duration-150 hover:border-[#0e7490]/40 active:scale-[0.99] dark:hover:border-[#5eead4]/40">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#0e7490]/10 text-[#0e7490] transition-colors duration-150 group-hover:bg-[#0e7490] group-hover:text-white dark:text-[#5eead4] dark:group-hover:bg-[#0e7490]">
                  <Icon className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-[var(--text)]">{a.label}</span>
                  <span className="block truncate text-xs text-[var(--text-soft)]">{a.hint}</span>
                </span>
                <kbd aria-hidden="true"
                  className="hidden h-6 min-w-6 shrink-0 place-items-center rounded-md border border-[var(--border)] px-1.5 font-mono text-[11px] text-[var(--text-soft)] sm:grid">
                  {a.shortcut}
                </kbd>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
