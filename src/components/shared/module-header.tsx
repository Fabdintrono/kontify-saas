import type { ReactNode } from "react";
import { GUIDES, type ModuleId } from "@/lib/guides";
import { ModuleGuide } from "./module-guide";

/** Cabecera estándar de módulo: título y subtítulo a la izquierda; a la derecha, siempre
 *  en este orden, el botón de Ayuda y después la acción primaria.
 *
 *  La ayuda estaba antes colgando del final del párrafo del subtítulo: se movía según el
 *  largo del texto y el ancho de la ventana, y partía la frase. WCAG 2.2 · 3.2.6 pide que
 *  un mecanismo de ayuda repetido conserve el mismo orden relativo en todas las páginas. */
// El subtítulo va en su propia línea, a todo el ancho: en teléfono, compartir fila con
// los botones lo dejaba en una columna de seis renglones.
export function ModuleHeader({ module, title, subtitle, actions }: {
  module: ModuleId; title?: string; subtitle?: string | null; actions?: ReactNode;
}) {
  const g = GUIDES[module];
  const sub = subtitle === undefined ? g.subtitle : subtitle;
  return (
    <div className="space-y-1.5">
      <div className="flex items-start justify-between gap-3">
        <h1 className="min-w-0 flex-1 text-xl font-extrabold tracking-[-0.4px] text-[var(--text)]">{title ?? g.title}</h1>
        <div className="flex shrink-0 items-center gap-2">
          <ModuleGuide guide={g} variant="button" />
          {actions}
        </div>
      </div>
      {sub && <p className="max-w-3xl text-sm text-[var(--text-soft)]">{sub}</p>}
    </div>
  );
}
