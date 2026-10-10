import type { ReactNode } from "react";

/** Ritmo único de toda pantalla de módulo: 16 px de margen en teléfono, 24 desde `sm`,
 *  y 20 px entre bloques. Antes cada página elegía el suyo. */
export function Page({ children }: { children: ReactNode }) {
  return <div className="space-y-5 p-4 sm:p-6">{children}</div>;
}
