import type { ReactNode } from "react";

/** Caja de toda lista: ancho completo, borde y relleno únicos.
 *  Dentro van la tabla de escritorio y las fichas de teléfono. */
export function ListBox({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-2 lg:p-4">{children}</div>;
}
