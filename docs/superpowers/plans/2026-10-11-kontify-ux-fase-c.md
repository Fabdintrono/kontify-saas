# Kontify — Fase C «Pulido» — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar la interfaz pareja y accesible: un solo botón, un solo chip, una sola etiqueta de campo; contraste que cumple en claro y oscuro; las líneas de venta legibles en el teléfono; y ningún control que mienta (el buscador global se esconde hasta que funcione).

**Architecture:** Tres primitivas nuevas y compartidas (`Button`, `StatusBadge`, y `FieldLabel` ya existente de Fase B) reemplazan 29 copias de la clase del botón primario, 5 chips distintos y 6 constantes `labelCls`. El contraste se arregla **en los tokens** (`globals.css`), no componente por componente, para que no vuelva a divergir. El documento de venta pasa de una tabla de 6 columnas a tarjeta por línea en móvil, reutilizando el patrón de `SaleRowCard`.

**Tech Stack:** Next 16 App Router, React 19, Tailwind 4 (`@theme` + `@custom-variant dark` en `globals.css`), Lucide, Vitest 4 + jsdom/@testing-library.

---

## Convenciones para quien implemente

- **Rama:** `feat/ux-fase-c` desde `master` (head `0e31900` o posterior). Un commit por tarea, mensajes en español (`feat(...)`, `fix(...)`, `refactor(...)`).
- **Tests:** `npx vitest run <archivo>` / `npx vitest run` (~40 s, Supabase local arriba). jsdom: primera línea `// @vitest-environment jsdom`, `afterEach(cleanup)`, imports explícitos de vitest (sin globals).
- **Typecheck/build:** `npx tsc --noEmit` · `npm run build`. No comitear `next-env.d.ts` (si el build lo ensucia: `git checkout -- next-env.d.ts`).
- **De Fases A y B se reutiliza:** `FieldLabel`/`FieldHelp` (`src/components/shared/`), `EmptyState` v2, `ModuleHeader`/`ModuleGuide`, `ConfirmDialog`/`ActionButton`, toasts, `src/lib/guides.ts` y `src/lib/field-help.ts`.
- **Estilo:** tokens `var(--bg|--surface|--border|--text|--text-soft)`; primario `#0e7490`; iconos Lucide; sin emojis; español neutro, sin «plata»; nunca `confirm()/alert()`.
- **Regla de contraste:** texto normal ≥ 4,5:1 contra el fondo **compuesto** sobre el que se pinta (incluido el `hover:bg-[var(--bg)]` de las filas). Medir, no estimar.
- No arrancar el servidor de desarrollo salvo en la verificación final. No hacer push.

---

### Task 1: Rama + tokens de contraste en `globals.css`

**Files:**
- Modify: `src/app/globals.css:20-33`
- Test: `tests/contrast.test.ts`

- [ ] **Step 1: Rama**

```bash
git checkout -b feat/ux-fase-c master
```

- [ ] **Step 2: Test que falla**

`tests/contrast.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/** Luminancia relativa (WCAG 2.x) de un hex #rrggbb. */
function lum(hex: string): number {
  const c = (hex.match(/\w\w/g) ?? []).map((x) => parseInt(x, 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function ratio(a: string, b: string): number {
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
/** Lee un token del bloque `:root` o `.dark` de globals.css. */
function token(name: string, scope: ":root" | ".dark"): string {
  const css = readFileSync("src/app/globals.css", "utf8");
  const block = css.split(scope)[1].split("}")[0];
  const m = block.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!m) throw new Error(`token --${name} no encontrado en ${scope}`);
  return m[1];
}

describe("contraste de los tokens de texto", () => {
  it("texto secundario cumple AA sobre fondo y superficie, en claro y oscuro", () => {
    for (const scope of [":root", ".dark"] as const) {
      const soft = token("text-soft", scope);
      for (const bgName of ["bg", "surface"] as const) {
        const bg = token(bgName, scope);
        expect(ratio(soft, bg), `--text-soft sobre --${bgName} en ${scope}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
  it("texto principal cumple AAA sobre superficie", () => {
    for (const scope of [":root", ".dark"] as const) {
      expect(ratio(token("text", scope), token("surface", scope))).toBeGreaterThanOrEqual(7);
    }
  });
});
```

- [ ] **Step 3: Correr y verificar que falla**

Run: `npx vitest run tests/contrast.test.ts`
Expected: FAIL — `--text-soft` claro (`#64748b`) da 4,34 sobre `--bg` (`#f1f5f9`).

- [ ] **Step 4: Subir el contraste del token**

En `src/app/globals.css`, bloque `:root`, cambiar solo esa línea:
```css
  --text-soft: #5b6b80;
```
(El bloque `.dark` ya cumple: `#94a3b8` sobre `#0b1220` da 6,6.)

- [ ] **Step 5: Correr y verificar que pasa**

Run: `npx vitest run tests/contrast.test.ts` → PASS (2). Si el segundo test falla, NO tocar `--text`: reportarlo (sería un cambio de marca, no de pulido).

- [ ] **Step 6: Commit**

```bash
git add src/app/globals.css tests/contrast.test.ts
git commit -m "fix(a11y): el texto secundario claro cumple AA sobre fondo y superficie"
```

---

### Task 2: `Button` único (3 variantes)

**Files:**
- Create: `src/components/ui/button.tsx`, `src/components/ui/button.test.tsx`
- Modify (reemplazos): `src/components/clientes/client-form.tsx:89`, `src/components/productos/product-form.tsx:110`, `src/components/cobros/payment-form.tsx:22,51,55`, `src/components/inventario/stock-adjust-form.tsx:25,72,75`, `src/components/ventas/sale-builder.tsx` (Guardar borrador / Emitir / Confirmar emisión), `src/components/presupuestos/quote-builder.tsx` (Guardar borrador / Enviar), `src/components/cobros/due-date-field.tsx:42`, `src/app/(app)/clientes/page.tsx:29`, `src/app/(app)/operaciones/productos/page.tsx`, `src/app/(app)/operaciones/facturacion/page.tsx`, `src/app/(app)/operaciones/presupuestos/page.tsx`, `src/app/(app)/operaciones/presupuestos/[id]/page.tsx`, `src/app/(app)/operaciones/facturacion/[id]/page.tsx`, `src/app/(app)/clientes/[id]/page.tsx`, `src/app/(app)/operaciones/productos/[id]/page.tsx`, `src/components/shared/empty-state.tsx:22`, `src/app/(app)/configuracion/tipos-de-cliente/page.tsx`, `src/app/(app)/configuracion/categorias-de-producto/page.tsx`, `src/app/(app)/configuracion/tasas-de-impuesto/page.tsx`

- [ ] **Step 1: Test que falla**

`src/components/ui/button.test.tsx`:
```tsx
// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { Button, buttonCls } from "./button";

afterEach(cleanup);

describe("Button", () => {
  it("las tres variantes comparten alto y radio", () => {
    for (const v of ["primary", "secondary", "danger"] as const) {
      expect(buttonCls(v)).toMatch(/h-10/);
      expect(buttonCls(v)).toMatch(/rounded-\[10px\]/);
    }
  });
  it("primary lleva gradiente y texto blanco; secondary borde; danger rojo", () => {
    expect(buttonCls("primary")).toMatch(/from-\[#0e7490\]/);
    expect(buttonCls("secondary")).toMatch(/border/);
    expect(buttonCls("danger")).toMatch(/#b91c1c|#dc2626/);
  });
  it("renderiza un botón accesible y respeta disabled", () => {
    render(<Button variant="primary" disabled>Guardar</Button>);
    const b = screen.getByRole("button", { name: "Guardar" });
    expect((b as HTMLButtonElement).disabled).toBe(true);
  });
  it("con `icon` lo pinta antes del texto y lo oculta al lector", () => {
    const { container } = render(<Button variant="primary" icon="plus">Nuevo cliente</Button>);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(screen.getByRole("button", { name: "Nuevo cliente" })).toBeTruthy();
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run src/components/ui/button.test.tsx` → FAIL `Cannot find module './button'`.

- [ ] **Step 3: Implementar `src/components/ui/button.tsx`**

```tsx
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";

export type ButtonVariant = "primary" | "secondary" | "danger";
const ICONS = { plus: Plus, pencil: Pencil, trash: Trash2 } as const;
export type ButtonIcon = keyof typeof ICONS;

const BASE = "inline-flex h-10 items-center justify-center gap-1.5 rounded-[10px] px-3 text-sm font-semibold disabled:opacity-60";
const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-gradient-to-br from-[#0e7490] to-[#14b8a6] text-white",
  secondary: "border border-[var(--border)] font-medium text-[var(--text)] hover:bg-[var(--bg)]",
  // En página, lo destructivo es secundario con texto rojo; el rojo sólido vive solo en el ConfirmDialog.
  danger: "border border-[#b91c1c]/40 font-medium text-[#b91c1c] hover:bg-[#b91c1c]/5 dark:text-[#f87171] dark:border-[#f87171]/40",
};

/** Clases del botón, para los casos en que hace falta un `<Link>` o un `<button>` de Radix con `asChild`. */
export function buttonCls(variant: ButtonVariant = "secondary", extra = ""): string {
  return `${BASE} ${VARIANT[variant]} ${extra}`.trim();
}

export function Button({ variant = "secondary", icon, className, children, ...rest }: {
  variant?: ButtonVariant; icon?: ButtonIcon; children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const Icon = icon ? ICONS[icon] : null;
  return (
    <button className={buttonCls(variant, className)} {...rest}>
      {Icon && <Icon className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />}{children}
    </button>
  );
}
```

- [ ] **Step 4: Correr y verificar que pasa** — PASS (4).

- [ ] **Step 5: Reemplazar las 29 copias**

Regla: los `<Link>` usan `className={buttonCls("primary")}` (con `<Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />` dentro cuando crean); los `<button>` de formulario usan `<Button variant=… disabled={pending}>`. En `src/components/shared/empty-state.tsx:22` sustituir la clase inline por `buttonCls("primary")` manteniendo el icono.
Después: `grep -rn "bg-gradient-to-br from-\[#0e7490\] to-\[#14b8a6\]" src --include=*.tsx` debe devolver solo `src/components/ui/button.tsx`, el avatar del topbar (`topbar.tsx`), el FAB (`fab-vender.tsx`), el «+» de la barra móvil (`mobile-bottom-nav.tsx`), el tile del riel (`rail.tsx`), el icono de `GettingStarted` y su barra de progreso — todos esos NO son botones de acción y se dejan.

- [ ] **Step 6: Verificar** — `npx tsc --noEmit` → 0; `npx vitest run` → verde; `npm run build` → OK.

- [ ] **Step 7: Commit**

```bash
git add -A src
git commit -m "refactor(ui): Button único de 3 variantes reemplaza las clases copiadas"
```

---

### Task 3: `StatusBadge` único con icono

**Files:**
- Create: `src/components/ui/status-badge.tsx`, `src/components/ui/status-badge.test.tsx`
- Modify: `src/components/ventas/status-badge.tsx` (pasa a envolver el nuevo), `src/components/presupuestos/quote-status-badge.tsx`, `src/components/inventario/stock-status-badge.tsx`, `src/components/clientes/type-badge.tsx`, `src/components/productos/category-badge.tsx`
- Delete: ninguno (los específicos quedan como envoltorios de una línea para no tocar 20 call sites)

- [ ] **Step 1: Test que falla**

`src/components/ui/status-badge.test.tsx`:
```tsx
// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { StatusBadge, TONE } from "./status-badge";

afterEach(cleanup);

describe("StatusBadge", () => {
  it("pinta icono + texto y no depende solo del color", () => {
    const { container } = render(<StatusBadge tone="danger" icon="alert" label="Vencida" />);
    expect(screen.getByText("Vencida")).toBeTruthy();
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });
  it("no se parte en dos líneas", () => {
    const { container } = render(<StatusBadge tone="ok" icon="check" label="En stock" />);
    expect(container.firstElementChild?.className).toMatch(/whitespace-nowrap/);
  });
  it("cada tono trae su variante oscura", () => {
    for (const cls of Object.values(TONE)) expect(cls).toMatch(/dark:/);
  });
  it("sin icono sigue siendo válido (etiquetas como el tipo de cliente)", () => {
    const { container } = render(<StatusBadge tone="info" label="Mayorista" />);
    expect(screen.getByText("Mayorista")).toBeTruthy();
    expect(container.querySelector("svg")).toBeNull();
  });
});
```

- [ ] **Step 2: Correr y verificar que falla** — FAIL (módulo inexistente).

- [ ] **Step 3: Implementar `src/components/ui/status-badge.tsx`**

```tsx
import type { LucideIcon } from "lucide-react";
import { Pencil, Check, CircleCheck, CircleDot, Clock, TriangleAlert, X, Send, ArrowRightLeft } from "lucide-react";

/** Tonos con su par claro/oscuro medidos ≥ 4,5:1 sobre --surface y sobre --bg (fila con hover). */
export const TONE = {
  neutral: "bg-[var(--bg)] text-[#475569] dark:text-[var(--text-soft)]",
  info:    "bg-[#0e7490]/10 text-[#155e75] dark:text-[#5eead4]",
  ok:      "bg-[#0f766e]/10 text-[#115e59] dark:text-[#6ee7b7]",
  warn:    "bg-[#b45309]/10 text-[#92400e] dark:text-[#fbbf24]",
  danger:  "bg-[#dc2626]/10 text-[#b91c1c] dark:text-[#f87171]",
  accent:  "bg-[#7c3aed]/10 text-[#6d28d9] dark:text-[#c4b5fd]",
} as const;
export type Tone = keyof typeof TONE;

const ICONS = {
  pencil: Pencil, check: Check, circleCheck: CircleCheck, dot: CircleDot,
  clock: Clock, alert: TriangleAlert, x: X, send: Send, convert: ArrowRightLeft,
} as const;
export type BadgeIcon = keyof typeof ICONS;

/** Chip de estado: color + icono + texto (nunca solo color), en una sola línea. */
export function StatusBadge({ tone, icon, label }: { tone: Tone; icon?: BadgeIcon; label: string }) {
  const Icon: LucideIcon | null = icon ? ICONS[icon] : null;
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${TONE[tone]}`}>
      {Icon && <Icon className="h-3 w-3 shrink-0" strokeWidth={2.5} aria-hidden="true" />}{label}
    </span>
  );
}
```

- [ ] **Step 4: Correr y verificar que pasa** — PASS (4).

- [ ] **Step 5: Los cinco chips existentes delegan**

`src/components/ventas/status-badge.tsx`: conservar la API (`status`, `paymentStatus`, `DANGER_TEXT`) y los mismos textos, pero construir el chip con `<StatusBadge tone icon label />` según el mapa actual: draft → `neutral`/`pencil`/«Borrador», issued → `info`/`check`/«Emitida», void → `danger`/`x`/«Anulada»; pagada → `ok`/`circleCheck`, parcial → `warn`/`dot`, pendiente → `warn`/`clock`, vencida → `danger`/`alert` (etiquetas desde `PAYMENT_LABEL`).
`quote-status-badge.tsx`: draft → `neutral`/`pencil`, sent → `info`/`send`, accepted → `ok`/`circleCheck`, rejected → `danger`/`x`, converted → `accent`/`convert`.
`stock-status-badge.tsx`: en_stock → `ok`/`circleCheck`, bajo → `warn`/`alert`, agotado → `danger`/`x`.
`type-badge.tsx` y `category-badge.tsx`: `<StatusBadge tone="info" label={name} />` (sin icono), manteniendo el «—» cuando `name` es nulo.
Los tests existentes (`src/components/ventas/status-badge.test.tsx`) deben seguir pasando sin tocarlos.

- [ ] **Step 6: Verificar + commit**

`npx tsc --noEmit` → 0; `npx vitest run` → verde; `npm run build` → OK.
```bash
git add -A src
git commit -m "refactor(ui): StatusBadge único con icono y tonos accesibles para los cinco chips"
```

---

### Task 4: Una sola etiqueta de campo (`FieldLabel` en todos los formularios)

**Files:**
- Modify: `src/components/clientes/client-form.tsx`, `src/components/productos/product-form.tsx`, `src/components/ventas/sale-builder.tsx`, `src/components/presupuestos/quote-builder.tsx`, `src/components/cobros/payment-form.tsx`, `src/components/inventario/stock-adjust-form.tsx`

- [ ] **Step 1: Sustituir `labelCls` por `FieldLabel`**

En los seis archivos: borrar la constante `labelCls` y reemplazar cada `<label className={labelCls}>Texto</label>` por `<FieldLabel htmlFor="<id>">Texto</FieldLabel>`, añadiendo el `id` correspondiente al control (usar el mismo valor que `name`). Los campos que ya tenían `help` en Fase B no se tocan. `id`s a crear: client-form → `name`, `email`, `phone`, `address`, `contactName`, `notes`; product-form → `kind`, `name`, `price`, `categoryId`, `description`; sale-builder → `clientId` (el `ClientPicker` recibe `inputId` nuevo), `notes`; quote-builder → `clientId`, `notes`; payment-form → `amount`, `paidAt`, `method`, `reference`, `notes`; stock-adjust-form → `productId`, `direction`, `quantity`, `reason`.
`ClientPicker` (`src/components/ventas/client-picker.tsx`) y `ProductPicker` aceptan una prop `inputId?: string` que ponen en su `<input>`.

- [ ] **Step 2: Verificar que no queda ninguna**

Run: `grep -rn "labelCls" src` → sin resultados.
Run: `npx tsc --noEmit` → 0; `npx vitest run` → verde.

- [ ] **Step 3: Test de regresión**

`src/components/clientes/client-form.test.tsx`:
```tsx
// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ClientForm } from "./client-form";

afterEach(cleanup);

describe("ClientForm", () => {
  it("cada campo visible tiene su etiqueta asociada", () => {
    render(<ClientForm action={async () => ({ ok: true })} types={[]} submitLabel="Crear cliente" />);
    for (const label of ["Nombre / Razón social *", "Documento / ID", "Teléfono", "Email", "Dirección", "Persona de contacto", "Notas"]) {
      expect(screen.getByLabelText(label), label).toBeTruthy();
    }
  });
});
```
Ajustar las props al contrato real de `ClientForm` (leerlo antes); si pedir `action` complica, pasar `async () => ({ ok: false })`.

- [ ] **Step 4: Commit**

```bash
git add -A src
git commit -m "refactor(a11y): todas las etiquetas de formulario pasan por FieldLabel con htmlFor"
```

---

### Task 5: Líneas de venta legibles en el teléfono

**Files:**
- Modify: `src/components/ventas/sale-document.tsx`, `src/components/presupuestos/quote-document.tsx`
- Test: `src/components/ventas/sale-document.test.tsx`

- [ ] **Step 1: Test que falla**

`src/components/ventas/sale-document.test.tsx`:
```tsx
// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { SaleDocument } from "./sale-document";

afterEach(cleanup);
const sale = {
  number: 7, status: "issued", currency: "USD", notes: null, payment_method: "Efectivo",
  total: 25.4, paid_amount: 25.4, due_date: null,
  clients: { name: "María" }, branches: { name: "Principal" },
  items: [{ id: "1", description: "Agua mineral 1.5L", quantity: 12, unit_price: 1.2, discount_pct: 0, tax_rate: 16 }],
  computed: { subtotal: 14.4, discountTotal: 0, taxTotal: 2.3, total: 16.7, lines: [{ neto: 14.4 }] },
};

describe("SaleDocument", () => {
  it("en móvil cada línea es una tarjeta con sus valores rotulados", () => {
    const { container } = render(<SaleDocument sale={sale as never} paymentStatus="pagada" />);
    // la tabla existe pero solo desde lg
    expect(container.querySelector("table")?.className).toMatch(/hidden|lg:table/);
    // y hay una lista de tarjetas para móvil
    const cards = container.querySelector("[data-lineas-movil]");
    expect(cards).not.toBeNull();
    expect(cards?.className).toMatch(/lg:hidden/);
    expect(screen.getAllByText("Agua mineral 1.5L").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Cant\./).length).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 2: Correr y verificar que falla** — FAIL: no existe `[data-lineas-movil]`.

- [ ] **Step 3: Implementar**

En `sale-document.tsx`, dar a la `<table>` la clase `hidden w-full text-sm lg:table` y añadir debajo:
```tsx
<ul data-lineas-movil className="space-y-2 lg:hidden">
  {sale.items.map((it, i) => (
    <li key={it.id} className="rounded-xl border border-[var(--border)] p-3">
      <p className="font-medium text-[var(--text)]">{it.description}</p>
      <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs text-[var(--text-soft)]">
        <div className="flex justify-between"><dt>Cant.</dt><dd className="text-[var(--text)]">{Number(it.quantity)}</dd></div>
        <div className="flex justify-between"><dt>Precio</dt><dd className="text-[var(--text)]">{formatMoney(Number(it.unit_price), c)}</dd></div>
        <div className="flex justify-between"><dt>Desc.</dt><dd className="text-[var(--text)]">{Number(it.discount_pct)}%</dd></div>
        <div className="flex justify-between"><dt>IVA</dt><dd className="text-[var(--text)]">{Number(it.tax_rate)}%</dd></div>
      </dl>
      <p className="mt-1 text-right text-sm font-semibold text-[var(--text)]">{formatMoney(sale.computed.lines[i]?.neto ?? 0, c)}</p>
    </li>
  ))}
</ul>
```
Hacer lo mismo en `quote-document.tsx` (mismo marcado, `quote.items` / `quote.computed`).

- [ ] **Step 4: Correr y verificar que pasa** — PASS (1).

- [ ] **Step 5: Commit**

```bash
git add -A src
git commit -m "fix(móvil): las líneas de la venta y del presupuesto se leen como tarjeta"
```

---

### Task 6: Buscador global escondido + `aria-label` que faltan

**Files:**
- Modify: `src/components/shell/topbar.tsx`, `src/components/shell/app-shell.tsx`
- Modify: `src/components/ventas/sale-builder.tsx`, `src/components/presupuestos/quote-builder.tsx` (botón de borrar línea)

- [ ] **Step 1: Quitar el buscador que no busca**

En `src/components/shell/topbar.tsx` borrar el bloque del `<input placeholder="Buscar productos, clientes, facturas…">` y su contenedor (deja el `flex-1` que empuja el resto a la derecha; si el layout queda raro, sustituirlo por `<div className="flex-1" />`). Dejar un comentario: `{/* Buscador global: vuelve cuando busque de verdad (ver auditoría UX, B4). */}`. Quitar el import de `Search` si queda sin uso.

- [ ] **Step 2: El selector de sucursal también es decorativo**

En `topbar.tsx` y en el top bar móvil de `app-shell.tsx`, el `DropdownMenu` de sucursal no filtra nada. Reemplazar el disparador por un chip no interactivo con el mismo aspecto: `<span className="flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 text-sm text-[var(--text-soft)]"><Store className="h-4 w-4" strokeWidth={2} aria-hidden="true" /> Todas</span>` y borrar el menú. Comentario: `{/* Selector de sucursal: hoy todo es consolidado; vuelve cuando filtre (Fase D). */}`.

- [ ] **Step 3: `aria-label` en los icon-buttons que faltan**

`sale-builder.tsx` y `quote-builder.tsx`: el botón de la papelera de cada línea → `aria-label={\`Quitar ${l.description || "línea"}\`}`.
Verificar que no queda ninguno: `grep -rn "<button" src/components src/app --include=*.tsx | grep -v "aria-label"` — cada resultado debe tener texto visible dentro.

- [ ] **Step 4: Verificar + commit**

`npx tsc --noEmit` → 0; `npx vitest run` → verde; `npm run build` → OK.
```bash
git add -A src
git commit -m "fix(ui): fuera el buscador y el selector de sucursal que no hacían nada; aria-label en los iconos sueltos"
```

---

### Task 7: Verificación final y entrega

- [ ] **Step 1:** `npx vitest run && npx tsc --noEmit && npm run build` → todo verde.
- [ ] **Step 2: Recorrido visual** (`npm run dev`; `demo@kontify.app / Kontify2026!`): botones de la misma altura en lista/detalle/formularios; chips con icono en ventas, presupuestos e inventario; formularios con etiquetas asociadas (hacer Tab y comprobar que el foco entra a cada campo); detalle de venta en 390px con tarjetas por línea; sin buscador ni selector de sucursal falsos; modo oscuro de todo lo anterior. Parar el servidor.
- [ ] **Step 3: Merge**
```bash
git checkout master && git merge --no-ff feat/ux-fase-c -m "Merge feat/ux-fase-c: Fase C Pulido (Button y StatusBadge únicos, contraste AA, etiquetas, móvil, controles falsos fuera)"
git push origin master
```
- [ ] **Step 4:** Actualizar `project_kontify.md`: Fase C mergeada y qué queda (buscador global real, selector de sucursal, pantalla de Sucursales y Usuarios, zona horaria en Configuración).

---

## Autorrevisión contra la spec (§4.1, §4.4 y §5 fila C)

| Requisito | Tarea |
|---|---|
| `--text-soft` claro → mejor contraste | Task 1 |
| `Button` 3 variantes, misma altura | Task 2 |
| `StatusBadge` unificado con icono, chips `nowrap` | Task 3 |
| `label htmlFor` en todos los campos | Task 4 |
| Líneas de venta en tarjeta en móvil | Task 5 |
| `aria-label` en icon-buttons | Task 6 |
| Buscador global real o escondido (B4) | Task 6 (escondido) |

Fuera de alcance (Fase D o producto): buscador global funcional, selector de sucursal funcional, pantallas de Sucursales y Usuarios (hoy placeholders), campo de zona horaria y de moneda en Configuración, selector de período del dashboard, formularios a dos columnas con Cancelar, placeholders descriptivos en los campos de texto, poder volver a mostrar «Primeros pasos» tras ocultarlo.
