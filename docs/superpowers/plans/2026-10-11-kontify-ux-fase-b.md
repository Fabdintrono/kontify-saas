# Kontify — Fase B «Guía» — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que cualquier usuario entienda cada módulo sin manual: cada pantalla dice en una línea qué es, tiene un panel «¿Cómo funciona?» con 3-5 pasos, los vacíos llevan a la acción, los campos raros tienen un «?», el dashboard trae un checklist de primeros pasos, y «Facturación» pasa a llamarse «Ventas».

**Architecture:** Todo el texto de ayuda vive centralizado en `src/lib/guides.ts` (módulos) y `src/lib/field-help.ts` (campos) para que Fabrizio lo corrija en un solo sitio. `ModuleHeader` (servidor) + `ModuleGuide` (cliente, Radix Sheet) reemplazan el `<h1>` suelto de cada módulo. `EmptyState` gana botón primario y enlace secundario sin romper a los consumidores actuales. `FieldLabel` + `FieldHelp` (Radix Popover) sustituyen las etiquetas de los 13 campos con duda. `GettingStarted` calcula el progreso con consultas reales (sin tabla nueva de tareas) y persiste solo el «Ocultar» en `tenants.getting_started_hidden`.

**Tech Stack:** Next 16 App Router, React 19, Tailwind 4, Supabase local (RLS), Radix Dialog/Popover (ya instalados), Lucide, Vitest 4 + jsdom/@testing-library.

---

## Convenciones para quien implemente

- **Rama:** `feat/ux-fase-b` desde `master` (head `e224dbc` o posterior). Un commit por tarea, mensajes en español (`feat(...)`, `fix(...)`, `test(...)`).
- **Tests:** `npx vitest run <archivo>` / `npx vitest run` (~40 s, Supabase local arriba: API 54321, DB 54322). Tests jsdom: primera línea `// @vitest-environment jsdom`, `afterEach(cleanup)`, imports de vitest explícitos (sin globals). Un elemento reutilizado en `rerender` NO re-renderiza: crear el árbol con una función.
- **Migración local (sin CLI de Supabase):**
  ```bash
  docker exec -i supabase_db_admin-saas psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < supabase/migrations/0028_getting_started_hidden.sql
  docker exec supabase_db_admin-saas psql -U postgres -d postgres -c "insert into supabase_migrations.schema_migrations(version, name, statements) values ('0028','getting_started_hidden','{}')"
  ```
- **Typecheck/build:** `npx tsc --noEmit` · `npm run build`. Next 16: `params`/`searchParams` son Promises; leer `node_modules/next/dist/docs/` ante dudas.
- **Lo que ya existe y se reutiliza (Fase A):** `src/components/ui/sheet.tsx` (Radix Dialog lateral, `side="right"`), `src/components/ui/popover.tsx`, `src/components/ui/action-button.tsx` (`action`, `payload`, `successToast`, `pendingLabel`), `src/lib/action-result.ts` (`ActionResult`, `actionError`), `src/lib/flash.ts` (`flashFor`), `src/lib/tenant.ts` (`getTenantSettings`), `src/components/shared/empty-state.tsx`.
- **Estilo:** tokens `var(--bg|--surface|--border|--text|--text-soft)`, primario `#0e7490`, gradiente `from-[#0e7490] to-[#14b8a6]`, cards `rounded-2xl border`, botón primario `rounded-[10px] bg-gradient-to-br … px-3 py-2 text-sm font-semibold text-white`. Iconos Lucide, sin emojis. Español neutro, sin «plata». Nunca `confirm()/alert()`.
- **Textos:** los de este plan están aprobados por Fabrizio (spec §4.2). No inventar otros; si algo no encaja, dejar el texto y reportarlo.

---

### Task 1: Rama + contenido de las guías (`src/lib/guides.ts`)

**Files:**
- Create: `src/lib/guides.ts`
- Test: `tests/guides.test.ts`

- [ ] **Step 1: Rama**

```bash
git checkout -b feat/ux-fase-b master
```

- [ ] **Step 2: Test que falla**

`tests/guides.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { GUIDES, MODULE_IDS, type ModuleId } from "@/lib/guides";

describe("guías de módulo", () => {
  it("todos los módulos tienen título, subtítulo de una línea y entre 1 y 6 pasos", () => {
    for (const id of MODULE_IDS) {
      const g = GUIDES[id as ModuleId];
      expect(g.title.length).toBeGreaterThan(2);
      expect(g.subtitle.length).toBeGreaterThan(20);
      expect(g.subtitle.length).toBeLessThanOrEqual(170);
      expect(g.subtitle).not.toMatch(/\n/);
      expect(g.steps.length).toBeGreaterThanOrEqual(1);
      expect(g.steps.length).toBeLessThanOrEqual(6);
    }
  });
  it("sin emojis ni la palabra prohibida", () => {
    const all = JSON.stringify(GUIDES);
    expect(all).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
    expect(all.toLowerCase()).not.toMatch(/\bplata\b/);
  });
  it("ventas se llama Ventas (no Facturación)", () => {
    expect(GUIDES.ventas.title).toBe("Ventas");
  });
});
```

- [ ] **Step 3: Correr y verificar que falla**

Run: `npx vitest run tests/guides.test.ts` → FAIL `Cannot find module '@/lib/guides'`.

- [ ] **Step 4: Implementar `src/lib/guides.ts`**

```ts
// Textos de ayuda por módulo (aprobados en la auditoría UX 2026-10-10, spec §4.2).
// Un solo sitio para corregir copy. Sin emojis; español neutro.

export const MODULE_IDS = [
  "dashboard", "clientes", "productos", "inventario", "ventas", "presupuestos",
  "cuentas_por_cobrar", "reportes_ventas", "reportes_inventario",
  "config_tipos_cliente", "config_categorias", "config_tasas", "config_preferencias",
] as const;
export type ModuleId = (typeof MODULE_IDS)[number];

export type Guide = {
  title: string;
  /** Una línea bajo el título: qué es este módulo. */
  subtitle: string;
  /** Pasos numerados del panel «¿Cómo funciona?». Vacío = sin panel. */
  steps: string[];
  /** «Lo que NO hace», para evitar expectativas equivocadas. */
  notDoes?: string[];
};

export const GUIDES: Record<ModuleId, Guide> = {
  dashboard: {
    title: "Inicio",
    subtitle: "Lo importante de tu negocio en un vistazo: ventas y utilidad del mes, clientes, inventario y lo que requiere atención.",
    steps: [
      "Los indicadores de arriba resumen el mes en curso de toda la empresa.",
      "«Requieren atención» lista ventas vencidas y productos agotados o bajo mínimo; cada fila lleva al detalle.",
      "El selector de sucursal (arriba) cambia entre una sede y el consolidado.",
    ],
    notDoes: ["No reemplaza a los reportes: para períodos y desgloses usa Reportes › Ventas."],
  },
  clientes: {
    title: "Clientes",
    subtitle: "Personas o empresas a las que vendes. Los tipos (Mayorista, Minorista…) te sirven para filtrar y reportar.",
    steps: [
      "Crea el cliente con «Nuevo cliente»: basta el nombre; el resto es opcional.",
      "Asígnale un tipo para filtrar listas y ver «Clientes por tipo» en el inicio.",
      "En su ficha ves el historial de compras y cuánto te debe.",
      "Archivar no borra: lo oculta de las listas y conserva su historial. Puedes reactivarlo cuando quieras.",
    ],
    notDoes: ["No hace falta crear un cliente para vender: existe «Consumidor final»."],
  },
  productos: {
    title: "Productos",
    subtitle: "Tu catálogo: lo que vendes, a qué precio y con qué impuesto. Las existencias se manejan en Inventario.",
    steps: [
      "Crea el producto como bien (lleva stock) o servicio (no lleva).",
      "Precio es lo que cobras; costo es lo que te cuesta y sirve para calcular la utilidad. Vendedores y cajeros no ven el costo.",
      "Categoría e impuesto se eligen de listas que puedes ampliar al vuelo.",
      "Stock mínimo: por debajo de ese número el inicio te avisa «bajo».",
    ],
    notDoes: ["Aquí no se cargan existencias: eso se hace en Inventario con «Ajustar stock»."],
  },
  inventario: {
    title: "Inventario",
    subtitle: "Cuánto tienes de cada producto por sucursal. Baja solo con ventas emitidas; sube con ajustes o anulaciones.",
    steps: [
      "Carga la existencia inicial de cada producto con «Ajustar stock» (entrada).",
      "Cada venta emitida descuenta; anularla lo repone.",
      "«Bajo» = existencia por debajo del mínimo del producto. «Agotado» = cero o menos.",
      "Un número negativo significa que vendiste sin haber cargado el stock: ajústalo con una entrada.",
    ],
    notDoes: ["No bloquea la venta sin stock: Kontify deja vender y te avisa."],
  },
  ventas: {
    title: "Ventas",
    subtitle: "Documento de venta interno (no fiscal). Guarda como borrador o emite: al emitir toma número, descuenta stock y queda listo para cobrar.",
    steps: [
      "Elige el cliente o deja «Consumidor final».",
      "Agrega productos; puedes ajustar cantidad, precio, descuento e IVA por línea.",
      "Guardar borrador no afecta nada. Emitir asigna el número, descuenta el stock y fija el cobro.",
      "Contado registra el cobro completo en el acto; crédito deja saldo pendiente con fecha de vencimiento opcional.",
      "Anular una venta emitida repone el stock. No se puede anular si ya tiene cobros.",
    ],
    notDoes: ["No es una factura fiscal: no sustituye tu facturación legal."],
  },
  presupuestos: {
    title: "Presupuestos",
    subtitle: "Cotizaciones para el cliente. No tocan stock ni numeración de ventas; al aceptarse se convierten en venta.",
    steps: [
      "Crea el presupuesto como una venta: cliente, productos y vigencia opcional.",
      "Enviar le asigna un número propio (serie aparte de las ventas).",
      "Márcalo aceptado o rechazado según responda el cliente.",
      "Convertir en venta crea un borrador de venta con las mismas líneas: revísalo y emítelo.",
    ],
    notDoes: ["No descuenta stock ni genera cobros hasta que la venta resultante se emite."],
  },
  cuentas_por_cobrar: {
    title: "Cuentas por cobrar",
    subtitle: "Lo que te deben, por cliente. Registra abonos totales o parciales.",
    steps: [
      "La lista muestra cuánto debe cada cliente y qué parte está vencida.",
      "Entra al cliente para ver cada venta con saldo y registrar un abono.",
      "Un abono puede ser parcial; la venta queda «Parcial» hasta saldarse.",
      "Anular un abono devuelve el saldo a la venta.",
    ],
  },
  reportes_ventas: {
    title: "Reporte de ventas",
    subtitle: "Ventas, ingresos y utilidad por período. La utilidad usa el costo que tenía cada producto al venderse.",
    steps: [
      "Elige un período con los botones o un rango de fechas.",
      "Filtra por sucursal si tienes más de una.",
      "Los desgloses muestran ventas por día, top de productos, por vendedor y por cliente.",
    ],
    notDoes: ["No incluye borradores ni ventas anuladas."],
  },
  reportes_inventario: {
    title: "Valorización de inventario",
    subtitle: "Valor de lo que tienes en almacén: existencia por costo de cada producto.",
    steps: ["Cada fila es un producto en una sucursal; el total suma todas."],
    notDoes: ["Los servicios y los productos sin costo no se valorizan."],
  },
  config_tipos_cliente: {
    title: "Tipos de cliente",
    subtitle: "Etiquetas para agrupar clientes (Mayorista, Minorista…). Los tipos inactivos no aparecen al crear clientes, pero se conservan en los existentes.",
    steps: [],
  },
  config_categorias: {
    title: "Categorías de producto",
    subtitle: "Agrupan el catálogo. Las categorías inactivas no aparecen al crear productos, pero se conservan en los existentes.",
    steps: [],
  },
  config_tasas: {
    title: "Tasas de impuesto",
    subtitle: "Porcentajes que se aplican por producto. La predeterminada se preselecciona al crear productos; solo puede haber una.",
    steps: [],
  },
  config_preferencias: {
    title: "Preferencias",
    subtitle: "Ajustes de este dispositivo, como el tema claro u oscuro.",
    steps: [],
  },
};
```

- [ ] **Step 5: Correr y verificar que pasa** — `npx vitest run tests/guides.test.ts` → PASS (3).

- [ ] **Step 6: Commit**

```bash
git add src/lib/guides.ts tests/guides.test.ts
git commit -m "feat(guia): textos centralizados por módulo (subtítulo, pasos, lo que no hace)"
```

---

### Task 2: `ModuleGuide` (panel «¿Cómo funciona?») y `ModuleHeader`

**Files:**
- Create: `src/components/shared/module-guide.tsx`, `src/components/shared/module-guide.test.tsx`
- Create: `src/components/shared/module-header.tsx`, `src/components/shared/module-header.test.tsx`

- [ ] **Step 1: Test del panel (falla)**

`src/components/shared/module-guide.test.tsx`:
```tsx
// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ModuleGuide } from "./module-guide";
import { GUIDES } from "@/lib/guides";

afterEach(cleanup);

describe("ModuleGuide", () => {
  it("el enlace abre el panel con los pasos numerados y lo que no hace", () => {
    render(<ModuleGuide guide={GUIDES.ventas} />);
    expect(screen.queryByText("Elige el cliente o deja «Consumidor final».")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /cómo funciona/i }));
    expect(screen.getByRole("dialog", { name: /cómo funciona ventas/i })).toBeTruthy();
    expect(screen.getByText("Elige el cliente o deja «Consumidor final».")).toBeTruthy();
    expect(screen.getByText(/no es una factura fiscal/i)).toBeTruthy();
    expect(screen.getAllByRole("listitem").length).toBeGreaterThanOrEqual(GUIDES.ventas.steps.length);
  });
  it("sin pasos no renderiza nada", () => {
    const { container } = render(<ModuleGuide guide={GUIDES.config_tasas} />);
    expect(container.innerHTML).toBe("");
  });
});
```

- [ ] **Step 2: Correr y verificar que falla** — `npx vitest run src/components/shared/module-guide.test.tsx` → FAIL (módulo inexistente).

- [ ] **Step 3: Implementar `src/components/shared/module-guide.tsx`**

```tsx
"use client";
import { useState } from "react";
import { CircleHelp } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import type { Guide } from "@/lib/guides";

/** Enlace «¿Cómo funciona?» que abre un panel lateral con los pasos del módulo.
 *  No se abre solo nunca (sin tours bloqueantes). Si la guía no tiene pasos, no renderiza nada. */
export function ModuleGuide({ guide, className }: { guide: Guide; className?: string }) {
  const [open, setOpen] = useState(false);
  if (guide.steps.length === 0) return null;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1 text-xs font-semibold text-[#0e7490] hover:underline dark:text-[#5eead4] ${className ?? ""}`}>
        <CircleHelp className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" /> ¿Cómo funciona?
      </button>
      <Sheet open={open} onOpenChange={setOpen} side="right" title={`¿Cómo funciona ${guide.title}?`}>
        <p className="mb-4 text-sm text-[var(--text-soft)]">{guide.subtitle}</p>
        <ol className="space-y-3">
          {guide.steps.map((s, i) => (
            <li key={i} className="flex gap-3 text-sm text-[var(--text)]">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#0e7490]/10 text-xs font-bold text-[#0e7490] dark:text-[#5eead4]">{i + 1}</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
        {guide.notDoes && guide.notDoes.length > 0 && (
          <div className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3">
            <p className="mb-1 text-xs font-bold uppercase tracking-wide text-[var(--text-soft)]">Lo que no hace</p>
            <ul className="space-y-1">
              {guide.notDoes.map((n, i) => <li key={i} className="text-sm text-[var(--text)]">{n}</li>)}
            </ul>
          </div>
        )}
      </Sheet>
    </>
  );
}
```
Nota: `Sheet` ya pone `Dialog.Title` con el `title`, que da el nombre accesible del diálogo. Si Radix avisa por falta de `Description`, añadir en `src/components/ui/sheet.tsx` un `<Dialog.Description className="sr-only">Panel de ayuda</Dialog.Description>` bajo el título (y Tailwind trae `sr-only`).

- [ ] **Step 4: Correr y verificar que pasa** — PASS (2).

- [ ] **Step 5: Test del header (falla)**

`src/components/shared/module-header.test.tsx`:
```tsx
// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ModuleHeader } from "./module-header";

afterEach(cleanup);

describe("ModuleHeader", () => {
  it("muestra título, subtítulo, el enlace de ayuda y las acciones", () => {
    render(<ModuleHeader module="clientes" actions={<a href="/clientes/nuevo">Nuevo cliente</a>} />);
    expect(screen.getByRole("heading", { level: 1, name: "Clientes" })).toBeTruthy();
    expect(screen.getByText(/Personas o empresas a las que vendes/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /cómo funciona/i })).toBeTruthy();
    expect(screen.getByText("Nuevo cliente")).toBeTruthy();
  });
  it("permite sobrescribir el título (p. ej. con un nombre de cliente)", () => {
    render(<ModuleHeader module="cuentas_por_cobrar" title="Distribuidora El Sol" />);
    expect(screen.getByRole("heading", { level: 1, name: "Distribuidora El Sol" })).toBeTruthy();
  });
});
```

- [ ] **Step 6: Implementar `src/components/shared/module-header.tsx`** (componente de servidor; `ModuleGuide` es cliente)

```tsx
import type { ReactNode } from "react";
import { GUIDES, type ModuleId } from "@/lib/guides";
import { ModuleGuide } from "./module-guide";

/** Cabecera estándar de módulo: título · subtítulo de una línea · «¿Cómo funciona?» · acciones a la derecha. */
export function ModuleHeader({ module, title, subtitle, actions }: {
  module: ModuleId; title?: string; subtitle?: string | null; actions?: ReactNode;
}) {
  const g = GUIDES[module];
  const sub = subtitle === undefined ? g.subtitle : subtitle;
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-extrabold tracking-[-0.4px] text-[var(--text)]">{title ?? g.title}</h1>
        {sub && (
          <p className="mt-0.5 max-w-3xl text-sm text-[var(--text-soft)]">
            {sub} <ModuleGuide guide={g} className="ml-1 align-baseline" />
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
```

- [ ] **Step 7: Correr y verificar** — `npx vitest run src/components/shared/module-header.test.tsx src/components/shared/module-guide.test.tsx` → PASS (4). `npx tsc --noEmit` → 0.

- [ ] **Step 8: Commit**

```bash
git add src/components/shared/module-guide.tsx src/components/shared/module-guide.test.tsx src/components/shared/module-header.tsx src/components/shared/module-header.test.tsx src/components/ui/sheet.tsx
git commit -m "feat(guia): ModuleHeader con subtítulo y panel lateral «¿Cómo funciona?»"
```

---

### Task 3: `EmptyState` v2 (botón primario + enlace secundario + tono «todo bien»)

**Files:**
- Modify: `src/components/shared/empty-state.tsx`
- Test: `src/components/shared/empty-state.test.tsx`

- [ ] **Step 1: Ampliar el test (falla)**

Reemplazar `src/components/shared/empty-state.test.tsx` por:
```tsx
// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { Inbox } from "lucide-react";
import { EmptyState } from "./empty-state";

afterEach(cleanup);

describe("EmptyState", () => {
  it("muestra título y pista (compatibilidad)", () => {
    render(<EmptyState icon={Inbox} title="Sin datos aún" hint="Vuelve pronto" />);
    expect(screen.getByText("Sin datos aún")).toBeTruthy();
    expect(screen.getByText("Vuelve pronto")).toBeTruthy();
  });
  it("con action renderiza un enlace primario con el símbolo +", () => {
    render(<EmptyState icon={Inbox} title="Tu catálogo está vacío" action={{ href: "/operaciones/productos/nuevo", label: "Nuevo producto" }} />);
    const a = screen.getByRole("link", { name: /nuevo producto/i });
    expect(a.getAttribute("href")).toBe("/operaciones/productos/nuevo");
  });
  it("acepta un secundario (p. ej. el enlace de ayuda) y el tono ok", () => {
    const { container } = render(<EmptyState icon={Inbox} title="Nadie te debe" tone="ok" secondary={<span>ayuda</span>} />);
    expect(screen.getByText("ayuda")).toBeTruthy();
    expect(container.querySelector("svg")?.getAttribute("class")).toMatch(/0f766e/);
  });
});
```

- [ ] **Step 2: Correr y verificar que falla** — `npx vitest run src/components/shared/empty-state.test.tsx` → FAIL (2 de 3).

- [ ] **Step 3: Reescribir `src/components/shared/empty-state.tsx`**

```tsx
import Link from "next/link";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Plus } from "lucide-react";

/** Vacío que explica la causa y lleva a la acción (Polaris: «di por qué está vacío y qué hacer»).
 *  `tone="ok"` para vacíos buenos («Nadie te debe», «Todo en orden»). */
export function EmptyState({ icon: Icon, title, hint, action, secondary, tone = "neutral" }: {
  icon: LucideIcon; title: string; hint?: string;
  action?: { href: string; label: string; plus?: boolean };
  secondary?: ReactNode; tone?: "neutral" | "ok";
}) {
  const iconCls = tone === "ok" ? "text-[#0f766e] dark:text-[#6ee7b7]" : "text-[var(--text-soft)]";
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
      <div className="grid h-11 w-11 place-items-center rounded-xl border border-[var(--border)] bg-[var(--bg)]">
        <Icon className={`h-5 w-5 ${iconCls}`} strokeWidth={2} aria-hidden="true" />
      </div>
      <p className="text-sm font-semibold text-[var(--text)]">{title}</p>
      {hint && <p className="max-w-md text-xs text-[var(--text-soft)]">{hint}</p>}
      {(action || secondary) && (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
          {action && (
            <Link href={action.href}
              className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-br from-[#0e7490] to-[#14b8a6] px-3 py-2 text-sm font-semibold text-white">
              {action.plus !== false && <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />}{action.label}
            </Link>
          )}
          {secondary}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Correr y verificar que pasa** — PASS (3). `npx tsc --noEmit` → 0 (los consumidores actuales usan solo `icon/title/hint`).

- [ ] **Step 5: Commit**

```bash
git add src/components/shared/empty-state.tsx src/components/shared/empty-state.test.tsx
git commit -m "feat(guia): EmptyState con botón primario, enlace secundario y tono ok"
```

---

### Task 4: Cablear cabeceras y vacíos en todos los módulos + renombres

**Files:**
- Modify: `src/app/(app)/clientes/page.tsx`, `src/app/(app)/operaciones/productos/page.tsx`, `src/app/(app)/operaciones/inventario/page.tsx`, `src/app/(app)/operaciones/facturacion/page.tsx`, `src/app/(app)/operaciones/presupuestos/page.tsx`, `src/app/(app)/finanzas/cuentas-por-cobrar/page.tsx`, `src/app/(app)/finanzas/cuentas-por-cobrar/[clientId]/page.tsx`, `src/app/(app)/reportes/ventas/page.tsx`, `src/app/(app)/reportes/inventario/page.tsx`, `src/app/(app)/dashboard/page.tsx`
- Modify: `src/app/(app)/configuracion/tipos-de-cliente/page.tsx`, `src/app/(app)/configuracion/categorias-de-producto/page.tsx`, `src/app/(app)/configuracion/tasas-de-impuesto/page.tsx`, `src/app/(app)/configuracion/preferencias/page.tsx`
- Modify (renombres): `src/lib/nav.ts:25`, `src/components/inventario/stock-adjust-form.tsx:27,33`, `src/components/shell/mobile-bottom-nav.tsx:33`, `docs/design/design-system.md:64`

- [ ] **Step 1: Listas con `ModuleHeader` y `EmptyState` v2**

Patrón (ejemplo Clientes, `src/app/(app)/clientes/page.tsx`): reemplazar el bloque `<div className="flex items-center justify-between"><h1 …>Clientes</h1><Link …>+ Nuevo cliente</Link></div>` por
```tsx
import { ModuleHeader } from "@/components/shared/module-header";
import { ModuleGuide } from "@/components/shared/module-guide";
import { GUIDES } from "@/lib/guides";
// …
<ModuleHeader module="clientes" actions={
  <Link href="/clientes/nuevo" className="flex items-center gap-1.5 rounded-[10px] bg-gradient-to-br from-[#0e7490] to-[#14b8a6] px-3 py-2 text-sm font-semibold text-white">
    <Plus className="h-4 w-4" strokeWidth={2.5} /> Nuevo cliente
  </Link>} />
```
y el vacío por
```tsx
<EmptyState icon={Users} title="Aún no tienes clientes"
  hint="También puedes vender a Consumidor final sin crear uno."
  action={{ href: "/clientes/nuevo", label: "Nuevo cliente" }}
  secondary={<ModuleGuide guide={GUIDES.clientes} />} />
```
Aplicar el mismo patrón con estos textos exactos:

| Página | `module` | Acción en cabecera | Vacío: title · hint · action |
|---|---|---|---|
| Productos | `productos` | «+ Nuevo producto» (si `canManageProducts`) | «Tu catálogo está vacío» · «Crea bienes (con stock) o servicios (sin stock).» · `/operaciones/productos/nuevo` «Nuevo producto» (solo si puede crear; si no, sin action) |
| Inventario | `inventario` | el `<StockAdjustForm …/>` actual (si `canManageStock`) | «Sin existencias registradas» · «Carga la existencia inicial de cada producto con «Ajustar stock».» · sin `action` (el botón de ajuste ya está arriba); `secondary` = guía |
| Ventas (`facturacion/page.tsx`) | `ventas` | «+ Nueva venta» (si `canSell`) | «Aún no hay ventas» · «La primera venta puede ser a Consumidor final.» · `/operaciones/facturacion/nueva` «Nueva venta» |
| Presupuestos | `presupuestos` | «+ Nuevo presupuesto» | «Sin presupuestos» · «Cotiza sin tocar stock ni numeración de ventas.» · `/operaciones/presupuestos/nueva` «Nuevo presupuesto» |
| Cuentas por cobrar | `cuentas_por_cobrar` | el bloque Total/Vencido actual | «Nadie te debe» · «Las ventas a crédito con saldo aparecen aquí.» · `tone="ok"`, icono `CircleCheck`, sin action |
| CxC › cliente | `cuentas_por_cobrar` con `title={data.clientName ?? "Cliente"}` y `subtitle={null}` | el bloque Adeudado/Vencido actual | (sin cambios en el vacío) |
| Reportes › Ventas | `reportes_ventas` | — | el `<p>No hay ventas…</p>` → `<EmptyState icon={TrendingUp} title="Sin ventas en este período" hint="Prueba otro período o quita el filtro de sucursal." />` dentro de una card `rounded-2xl border` |
| Reportes › Inventario | `reportes_inventario` | el Total actual | el `<p>Sin existencias…</p>` → `<EmptyState icon={Boxes} title="Carga existencias para ver el valor" hint="El valor es existencia × costo de cada producto." />` |

Dashboard (`src/app/(app)/dashboard/page.tsx`): mantener el saludo como `<h1>` y añadir debajo
```tsx
<p className="mt-0.5 max-w-3xl text-sm text-[var(--text-soft)]">{GUIDES.dashboard.subtitle} <ModuleGuide guide={GUIDES.dashboard} className="ml-1 align-baseline" /></p>
```
(el comentario del selector de período se queda).

Configuración (4 páginas): reemplazar el `<h1>` por `<ModuleHeader module="config_…" />` y **borrar el `<p className="text-xs …">` de pie** de tipos/categorías/tasas (ese texto ya es el subtítulo). Preferencias: `<ModuleHeader module="config_preferencias" />`.

- [ ] **Step 2: Renombres**

- `src/lib/nav.ts:25` → `{ label: "Ventas", href: "/operaciones/facturacion", icon: FileText }` (la ruta no cambia).
- `src/components/inventario/stock-adjust-form.tsx`: los dos textos «Registrar movimiento» → «Ajustar stock».
- `src/components/shell/mobile-bottom-nav.tsx:33`: `<Item href="/operaciones/inventario" icon={Boxes} label="Inventario" />` (antes iba al reporte).
- `docs/design/design-system.md:64` → `- **Operaciones** → Productos, Inventario, Ventas (ruta /operaciones/facturacion), Presupuestos`.
- Buscar cualquier otro «Facturación» visible: `grep -rn "Facturación" src` — debe quedar solo en comentarios/rutas, no en textos de UI. Los títulos «Nueva venta», «Editar borrador», «← Ventas» ya están bien.

- [ ] **Step 3: Verificar**

`npx tsc --noEmit` → 0. `npx vitest run` → verde. `npm run build` → OK. `grep -rn "Registrar movimiento\|>Facturación<" src` → nada.

- [ ] **Step 4: Commit**

```bash
git add -A src docs/design/design-system.md
git commit -m "feat(guia): cabeceras con subtítulo y ayuda en todos los módulos, vacíos con acción, Facturación→Ventas, Ajustar stock"
```

---

### Task 5: `FieldHelp` + `FieldLabel` en los 13 campos con duda

**Files:**
- Create: `src/lib/field-help.ts`, `src/components/shared/field-help.tsx`, `src/components/shared/field-label.tsx`, `src/components/shared/field-help.test.tsx`
- Modify: `src/components/clientes/client-form.tsx` (Tipo de registro, Documento / ID, Tipo de cliente), `src/components/productos/product-form.tsx` (SKU / código, Unidad, Costo, Stock mínimo, Impuesto), `src/components/ventas/sale-builder.tsx` (Sucursal, Descuento global %, Método de pago, Fecha de vencimiento), `src/components/presupuestos/quote-builder.tsx` (Sucursal, Válido hasta)

- [ ] **Step 1: Textos** — `src/lib/field-help.ts`:
```ts
// Ayudas cortas por campo (1-2 líneas). Un «?» junto a la etiqueta las muestra en un popover.
export const FIELD_HELP = {
  tipoRegistro: "Persona natural o empresa. Solo cambia qué datos tienen sentido (p. ej. razón social).",
  documentoId: "Cédula, RIF, NIT o el documento fiscal de tu país. Opcional, pero útil para buscar y para tus facturas.",
  tipoCliente: "Etiqueta para agrupar clientes (Mayorista, Minorista…). Se usa en filtros y en «Clientes por tipo».",
  sku: "Código corto y único del producto (p. ej. AGU-15). Sirve para buscar rápido. Opcional.",
  unidad: "Cómo se cuenta: unidad, caja, kg, litro… Es solo un texto que se muestra al vender.",
  costo: "Lo que te cuesta a ti. Vendedores y cajeros no lo ven; sirve para calcular la utilidad.",
  stockMinimo: "Por debajo de esta existencia el inicio te avisa «bajo». Déjalo en 0 si no quieres alertas.",
  impuesto: "Tasa que se aplica al vender este producto. Se puede cambiar línea por línea en la venta.",
  sucursal: "Sede donde se registra la operación. Afecta el stock que se descuenta y los reportes por sucursal.",
  descuentoGlobal: "Porcentaje que se aplica a toda la venta, prorrateado antes del impuesto. Los descuentos por línea van en cada fila.",
  metodoPago: "Texto libre para recordar cómo pagó (efectivo, transferencia, pago móvil…). Opcional.",
  vencimiento: "Fecha límite de pago de una venta a crédito. Pasada esa fecha, la venta aparece como «Vencida».",
  validoHasta: "Hasta cuándo mantienes el precio cotizado. Pasada la fecha, el presupuesto se marca «vencido» (no se bloquea).",
} as const;
export type FieldHelpKey = keyof typeof FIELD_HELP;
```

- [ ] **Step 2: Test (falla)** — `src/components/shared/field-help.test.tsx`:
```tsx
// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { FieldLabel } from "./field-label";

afterEach(cleanup);

describe("FieldLabel + FieldHelp", () => {
  it("asocia la etiqueta al input y abre la ayuda al pulsar el ?", () => {
    render(<><FieldLabel htmlFor="costo" help="costo">Costo</FieldLabel><input id="costo" /></>);
    expect(screen.getByLabelText("Costo")).toBeTruthy();
    const btn = screen.getByRole("button", { name: "Ayuda sobre Costo" });
    expect(screen.queryByText(/Lo que te cuesta a ti/)).toBeNull();
    fireEvent.click(btn);
    expect(screen.getByText(/Lo que te cuesta a ti/)).toBeTruthy();
  });
  it("sin help no renderiza el botón", () => {
    render(<><FieldLabel htmlFor="n">Nombre</FieldLabel><input id="n" /></>);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
```
Run: `npx vitest run src/components/shared/field-help.test.tsx` → FAIL.

- [ ] **Step 3: Implementar**

`src/components/shared/field-help.tsx`:
```tsx
"use client";
import * as PO from "@radix-ui/react-popover";
import { CircleHelp } from "lucide-react";
import { FIELD_HELP, type FieldHelpKey } from "@/lib/field-help";

/** «?» junto a una etiqueta. Popover (no tooltip de hover): funciona con teclado y en pantallas táctiles. */
export function FieldHelp({ help, label }: { help: FieldHelpKey; label: string }) {
  return (
    <PO.Root>
      <PO.Trigger asChild>
        <button type="button" aria-label={`Ayuda sobre ${label}`}
          className="grid h-4 w-4 place-items-center rounded-full text-[var(--text-soft)] hover:text-[#0e7490] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0e7490]">
          <CircleHelp className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
        </button>
      </PO.Trigger>
      <PO.Portal>
        <PO.Content side="top" align="start" sideOffset={6}
          className="z-50 max-w-xs rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-xs leading-relaxed text-[var(--text)] shadow-lg">
          {FIELD_HELP[help]}
          <PO.Arrow className="fill-[var(--surface)]" />
        </PO.Content>
      </PO.Portal>
    </PO.Root>
  );
}
```
`src/components/shared/field-label.tsx` (sin `"use client"`; puede usarse desde cliente o servidor):
```tsx
import type { ReactNode } from "react";
import { FieldHelp } from "./field-help";
import type { FieldHelpKey } from "@/lib/field-help";

/** Etiqueta de campo asociada por `htmlFor` y, si procede, con un «?» de ayuda. */
export function FieldLabel({ htmlFor, help, children }: { htmlFor: string; help?: FieldHelpKey; children: ReactNode }) {
  return (
    <div className="mb-1 flex items-center gap-1.5">
      <label htmlFor={htmlFor} className="block text-xs font-medium text-[var(--text-soft)]">{children}</label>
      {help && <FieldHelp help={help} label={String(children).replace(/\s*\*$/, "")} />}
    </div>
  );
}
```
(`String(children)` funciona porque los hijos son texto plano; si un campo pasa JSX, pasar además una prop `label`. YAGNI por ahora.)

- [ ] **Step 4: Correr y verificar que pasa** — PASS (2).

- [ ] **Step 5: Aplicar en los formularios** (añadir `id` al input/select y usar `FieldLabel`):

`client-form.tsx`: `Tipo de registro` → `<FieldLabel htmlFor="kind" help="tipoRegistro">Tipo de registro</FieldLabel>` + `id="kind"` en el select; `Documento / ID` → `help="documentoId"`, `id="docId"`; `Tipo de cliente` → `help="tipoCliente"`, `id="typeId"`.
`product-form.tsx`: `SKU / código` (`help="sku"`, `id="sku"`), `Unidad` (`unidad`, `id="unit"`), `Costo` (`costo`, `id="cost"`), `Stock mínimo` (`stockMinimo`, `id="minStock"`), `Impuesto` (`impuesto`, `id="taxRateId"`).
`sale-builder.tsx`: `Sucursal` (`sucursal`, `id="branchId"` en el select), `Descuento global %` (`descuentoGlobal`, `id="globalDiscountPct"` en ese input; aquí la etiqueta está en una fila flex con tipografía propia: usar `FieldHelp` directamente (fila inline), no `FieldLabel`), `Método de pago (opcional)` (`metodoPago`, `id="paymentMethod"`), `Fecha de vencimiento (opcional)` (`vencimiento`, `id="dueDate"`).
`quote-builder.tsx`: `Sucursal` (`sucursal`, `id="branchId"`), `Válido hasta` (`validoHasta`, `id="validUntil"`).
Las demás etiquetas se dejan como están (Fase C hará el `htmlFor` global).

- [ ] **Step 6: Verificar** — `npx tsc --noEmit` → 0; `npx vitest run` → verde; `npm run build` → OK.

- [ ] **Step 7: Commit**

```bash
git add -A src
git commit -m "feat(guia): «?» de ayuda en los 13 campos con duda (FieldLabel + FieldHelp, popover accesible)"
```

---

### Task 6: `GettingStarted` (primeros pasos) en el dashboard

**Files:**
- Create: `supabase/migrations/0028_getting_started_hidden.sql`
- Create: `src/lib/dashboard/getting-started.ts`, `tests/getting-started.test.ts`
- Create: `src/app/(app)/dashboard/actions.ts`
- Create: `src/components/dashboard/getting-started.tsx`, `src/components/dashboard/getting-started.test.tsx`
- Modify: `src/app/(app)/dashboard/page.tsx`, `src/lib/flash.ts` (clave `primeros-pasos-ocultos`)

- [ ] **Step 1: Migración**

`supabase/migrations/0028_getting_started_hidden.sql`:
```sql
-- 0028_getting_started_hidden.sql
-- El checklist «Primeros pasos» del inicio se calcula con datos reales; aquí solo se guarda si el
-- dueño/admin decidió ocultarlo (al llegar al 100 %).
alter table public.tenants
  add column if not exists getting_started_hidden boolean not null default false;
```
Aplicar con los dos comandos de «Convenciones» (versión `0028`, nombre `getting_started_hidden`).

- [ ] **Step 2: Test de integración (falla)** — `tests/getting-started.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { newUserClient } from "./setup";
import { gettingStartedStatus } from "@/lib/dashboard/getting-started";
import { registerAdjustment } from "@/lib/inventario/mutations";
import { createDraft, emitSale } from "@/lib/ventas/mutations";

async function makeTenant(name: string) {
  const u = await newUserClient();
  const { data: tenantId } = await u.client.rpc("bootstrap_tenant", {
    p_name: name, p_slug: `${name}-${Date.now()}-${Math.random()}`, p_full_name: name,
  });
  return { ...u, tenantId: tenantId as string };
}
async function mainBranch(t: any) {
  const { data } = await t.client.from("branches").select("id").eq("tenant_id", t.tenantId).eq("is_main", true).single();
  return data!.id as string;
}

describe("gettingStartedStatus", () => {
  it("empresa recién creada: 0 de 5, nada oculto, cada paso con enlace", async () => {
    const t = await makeTenant("gs0");
    const s = await gettingStartedStatus(t.client);
    expect(s.hidden).toBe(false);
    expect(s.items.map((i) => i.key)).toEqual(["producto", "existencias", "cliente", "venta", "equipo"]);
    expect(s.items.every((i) => !i.done && i.href.startsWith("/"))).toBe(true);
    expect(s.done).toBe(0); expect(s.total).toBe(5);
  });
  it("va marcando pasos con datos reales (producto, existencias, cliente, venta)", async () => {
    const t = await makeTenant("gs1"); const b = await mainBranch(t);
    const { data: p } = await t.client.from("products").insert({ tenant_id: t.tenantId, kind: "good", name: "Café", price: 10, cost: 4 }).select("id").single();
    let s = await gettingStartedStatus(t.client);
    expect(s.items.find((i) => i.key === "producto")!.done).toBe(true);
    expect(s.done).toBe(1);
    await registerAdjustment(t.client, t.tenantId, t.id, { productId: p!.id, branchId: b, direction: "in", quantity: 5, reason: "inicial" });
    await t.client.from("clients").insert({ tenant_id: t.tenantId, kind: "person", name: "Ana" });
    const id = await createDraft(t.client, t.tenantId, t.id, "USD", { clientId: null, branchId: b, globalDiscountPct: 0, notes: undefined, items: [
      { productId: p!.id, description: "Café", quantity: 1, unitPrice: 10, discountPct: 0, taxRate: 0 },
    ] });
    await emitSale(t.client, id, { paymentType: "contado", paymentMethod: "efectivo" }, "2026-10-11");
    s = await gettingStartedStatus(t.client);
    expect(s.done).toBe(4);
    expect(s.items.find((i) => i.key === "equipo")!.done).toBe(false);
  });
  it("hidden refleja la columna", async () => {
    const t = await makeTenant("gs2");
    await t.client.from("tenants").update({ getting_started_hidden: true }).eq("id", t.tenantId);
    expect((await gettingStartedStatus(t.client)).hidden).toBe(true);
  });
});
```
Run: `npx vitest run tests/getting-started.test.ts` → FAIL (módulo inexistente). Si `registerAdjustment` tiene otra firma, copiar la de `tests/inventario.test.ts`.

- [ ] **Step 3: Implementar `src/lib/dashboard/getting-started.ts`**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

export type GettingStartedItem = { key: "producto" | "existencias" | "cliente" | "venta" | "equipo"; label: string; href: string; done: boolean };
export type GettingStartedStatus = { items: GettingStartedItem[]; done: number; total: number; hidden: boolean };

const EMPTY: GettingStartedStatus = { items: [], done: 0, total: 5, hidden: true };

/** Progreso de «Primeros pasos» calculado con datos reales (no se guarda estado por tarea). Degrada a oculto ante error. */
export async function gettingStartedStatus(sb: SupabaseClient): Promise<GettingStartedStatus> {
  try {
    const [tenant, products, levels, clients, sales, members] = await Promise.all([
      sb.from("tenants").select("getting_started_hidden").maybeSingle(),
      sb.from("products").select("id", { count: "exact", head: true }).eq("active", true),
      sb.from("stock_levels").select("product_id", { count: "exact", head: true }).gt("qty", 0),
      sb.from("clients").select("id", { count: "exact", head: true }).eq("active", true),
      sb.from("sales").select("id", { count: "exact", head: true }).eq("status", "issued"),
      sb.from("memberships").select("user_id", { count: "exact", head: true }),
    ]);
    if (tenant.error || products.error || levels.error || clients.error || sales.error || members.error) return EMPTY;
    const items: GettingStartedItem[] = [
      { key: "producto", label: "Crea tu primer producto", href: "/operaciones/productos/nuevo", done: (products.count ?? 0) > 0 },
      { key: "existencias", label: "Carga existencias en Inventario", href: "/operaciones/inventario", done: (levels.count ?? 0) > 0 },
      { key: "cliente", label: "Registra un cliente", href: "/clientes/nuevo", done: (clients.count ?? 0) > 0 },
      { key: "venta", label: "Haz tu primera venta", href: "/operaciones/facturacion/nueva", done: (sales.count ?? 0) > 0 },
      { key: "equipo", label: "Invita a tu equipo", href: "/configuracion/usuarios", done: (members.count ?? 0) > 1 },
    ];
    return { items, done: items.filter((i) => i.done).length, total: items.length, hidden: !!tenant.data?.getting_started_hidden };
  } catch (e) { console.error("gettingStartedStatus", e); return EMPTY; }
}
```

- [ ] **Step 4: Correr y verificar que pasa** — PASS (3). (RLS: `memberships` select está scopeado por tenant — ver `0003_rls_policies.sql`; si el count diera 0 para el propio owner, usar `sb.from("memberships").select("user_id")` y contar en JS.)

- [ ] **Step 5: Acción «Ocultar»** — `src/app/(app)/dashboard/actions.ts`:
```ts
"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { actionError, type ActionResult } from "@/lib/action-result";
import type { Role } from "@/lib/auth/roles";

/** Oculta «Primeros pasos» para toda la empresa (solo dueño/admin). */
export async function hideGettingStartedAction(_fd: FormData): Promise<ActionResult> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const { data: mem } = await sb.from("memberships").select("role").eq("user_id", user.id).single();
  const role = (mem?.role ?? "vendedor") as Role;
  if (!["owner", "admin"].includes(role)) return { error: "No tienes permiso para esta acción." };
  const { data: tid } = await sb.rpc("current_tenant_id");
  try {
    const { error } = await sb.from("tenants").update({ getting_started_hidden: true }).eq("id", tid as string);
    if (error) throw error;
  } catch (e) { return actionError(e); }
  revalidatePath("/dashboard");
}
```
En `src/lib/flash.ts` añadir la clave `"primeros-pasos-ocultos": () => ({ title: "Primeros pasos ocultos", description: "Puedes seguir usando la guía «¿Cómo funciona?» de cada módulo." })` (y al tipo `FlashKey`).

- [ ] **Step 6: Test del componente (falla)** — `src/components/dashboard/getting-started.test.tsx`:
```tsx
// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ToastProvider } from "@/components/ui/toast";
import { GettingStarted } from "./getting-started";

afterEach(cleanup);
const items = (done: boolean[]) => ([
  { key: "producto", label: "Crea tu primer producto", href: "/operaciones/productos/nuevo", done: done[0] },
  { key: "existencias", label: "Carga existencias en Inventario", href: "/operaciones/inventario", done: done[1] },
  { key: "cliente", label: "Registra un cliente", href: "/clientes/nuevo", done: done[2] },
  { key: "venta", label: "Haz tu primera venta", href: "/operaciones/facturacion/nueva", done: done[3] },
  { key: "equipo", label: "Invita a tu equipo", href: "/configuracion/usuarios", done: done[4] },
] as const);

describe("GettingStarted", () => {
  it("muestra progreso, enlaza los pendientes y no ofrece Ocultar antes del 100 %", () => {
    render(<ToastProvider><GettingStarted status={{ items: [...items([true, false, false, false, false])], done: 1, total: 5, hidden: false }} canHide action={vi.fn(async () => {})} /></ToastProvider>);
    expect(screen.getByText("1 de 5")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Carga existencias/ }).getAttribute("href")).toBe("/operaciones/inventario");
    expect(screen.queryByRole("button", { name: /ocultar/i })).toBeNull();
  });
  it("al 100 % ofrece Ocultar solo a quien puede", () => {
    const all = { items: [...items([true, true, true, true, true])], done: 5, total: 5, hidden: false };
    const { rerender } = render(<ToastProvider><GettingStarted status={all} canHide action={vi.fn(async () => {})} /></ToastProvider>);
    expect(screen.getByRole("button", { name: /ocultar/i })).toBeTruthy();
    rerender(<ToastProvider><GettingStarted status={all} canHide={false} action={vi.fn(async () => {})} /></ToastProvider>);
    expect(screen.queryByRole("button", { name: /ocultar/i })).toBeNull();
  });
});
```

- [ ] **Step 7: Implementar `src/components/dashboard/getting-started.tsx`**

```tsx
import Link from "next/link";
import { CircleCheck, Circle, Rocket } from "lucide-react";
import { ActionButton } from "@/components/ui/action-button";
import { flashFor } from "@/lib/flash";
import type { GettingStartedStatus } from "@/lib/dashboard/getting-started";
import type { ActionResult } from "@/lib/action-result";

/** Checklist «Primeros pasos»: se calcula con datos reales y desaparece cuando el dueño lo oculta. */
export function GettingStarted({ status, canHide, action }: {
  status: GettingStartedStatus; canHide: boolean; action: (fd: FormData) => Promise<ActionResult>;
}) {
  if (status.hidden || status.items.length === 0) return null;
  const complete = status.done === status.total;
  const pct = Math.round((status.done / status.total) * 100);
  return (
    <section aria-labelledby="primeros-pasos" className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-[#0e7490] to-[#14b8a6] text-white"><Rocket className="h-4 w-4" strokeWidth={2} aria-hidden="true" /></span>
          <div>
            <h2 id="primeros-pasos" className="text-sm font-bold text-[var(--text)]">Primeros pasos</h2>
            <p className="text-xs text-[var(--text-soft)]">{complete ? "Todo listo. Kontify ya está trabajando contigo." : "Cinco pasos para dejar Kontify funcionando."}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-[var(--text-soft)]">{status.done} de {status.total}</span>
          {complete && canHide && (
            <ActionButton action={action} payload={{}} successToast={flashFor("primeros-pasos-ocultos")} pendingLabel="Ocultando…"
              className="rounded-[10px] border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--text)]">
              Ocultar
            </ActionButton>
          )}
        </div>
      </div>
      <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-[var(--bg)]" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-gradient-to-r from-[#0e7490] to-[#14b8a6]" style={{ width: `${pct}%` }} />
      </div>
      <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {status.items.map((it) => (
          <li key={it.key}>
            {it.done ? (
              <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] p-2.5 text-sm text-[var(--text-soft)] line-through">
                <CircleCheck className="h-4 w-4 shrink-0 text-[#0f766e] dark:text-[#6ee7b7]" strokeWidth={2} aria-hidden="true" />{it.label}
              </div>
            ) : (
              <Link href={it.href} className="flex items-center gap-2 rounded-lg border border-[var(--border)] p-2.5 text-sm font-medium text-[var(--text)] hover:bg-[var(--bg)]">
                <Circle className="h-4 w-4 shrink-0 text-[var(--text-soft)]" strokeWidth={2} aria-hidden="true" />{it.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
```

- [ ] **Step 8: Correr y verificar** — `npx vitest run src/components/dashboard/getting-started.test.tsx tests/getting-started.test.ts tests/flash.test.ts` → PASS.

- [ ] **Step 9: Dashboard** — en `src/app/(app)/dashboard/page.tsx`: sumar `gettingStartedStatus(supabase)` al `Promise.all` de consultas, importar `GettingStarted` y `hideGettingStartedAction`, y renderizar **justo debajo del saludo y antes de los KPIs**: `<GettingStarted status={gs} canHide={["owner", "admin"].includes(role)} action={hideGettingStartedAction} />`.

- [ ] **Step 10: Verificar + commit**

`npx tsc --noEmit` → 0 · `npx vitest run` → verde · `npm run build` → OK.
```bash
git add supabase/migrations/0028_getting_started_hidden.sql src/lib/dashboard/getting-started.ts tests/getting-started.test.ts "src/app/(app)/dashboard/actions.ts" "src/app/(app)/dashboard/page.tsx" src/components/dashboard/getting-started.tsx src/components/dashboard/getting-started.test.tsx src/lib/flash.ts
git commit -m "feat(guia): checklist «Primeros pasos» en el inicio, calculado con datos reales y ocultable por el dueño"
```

---

### Task 7: Verificación final y entrega

- [ ] **Step 1:** `npx vitest run && npx tsc --noEmit && npm run build` → todo verde.
- [ ] **Step 2: Recorrido visual** (`npm run dev`; `demo@kontify.app / Kontify2026!`; el controlador tiene un script Playwright): cada módulo muestra subtítulo + «¿Cómo funciona?» que abre el panel con pasos; el menú dice «Ventas»; «Ajustar stock» en Inventario; la pestaña móvil Inventario abre Operaciones › Inventario; vacíos con botón (probar con una empresa nueva registrada en `/registro`); «?» en Costo abre el popover y funciona con teclado (Tab + Enter); el dashboard de la empresa nueva muestra «Primeros pasos 0 de 5»; con todo hecho aparece «Ocultar» y al pulsarlo desaparece con el aviso. Parar el servidor.
- [ ] **Step 3: Merge**
```bash
git checkout master && git merge --no-ff feat/ux-fase-b -m "Merge feat/ux-fase-b: Fase B Guía (cabeceras con ayuda, vacíos con acción, ? en campos, primeros pasos, Ventas)"
git push origin master
```
- [ ] **Step 4:** Actualizar la memoria del proyecto (`project_kontify.md`): Fase B mergeada, migración 0028, textos en `guides.ts`/`field-help.ts`, sigue Fase C.

---

## Autorrevisión contra la spec (§4 y §5 fila B)

| Requisito | Tarea |
|---|---|
| ModuleHeader + panel «¿Cómo funciona?» en 9 módulos con los textos de §4.2 | Task 1 (textos), 2 (componentes), 4 (cableado; 9 módulos + 4 de Configuración) |
| EmptyState v2 con botón | Task 3 + 4 |
| FieldHelp en 13 campos | Task 5 |
| GettingStarted en dashboard | Task 6 |
| Renombres de §4.3: Facturación→Ventas, Ajustar stock, pestaña móvil Inventario | Task 4 |
| (§4.3) Lista de ventas con estado de pago y saldo rojo solo vencida | Hecho en Fase A |

Fuera de alcance (Fase C): Button/StatusBadge unificados, móvil líneas de venta, contraste `--text-soft`, formularios a 2 columnas con Cancelar, placeholders descriptivos, buscador global, `htmlFor` en el resto de campos, selector de período del dashboard, campo de zona horaria en Configuración.
