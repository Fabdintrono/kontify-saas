# Kontify Fundación — Plan 2: Diseño visual (shell dual-tier + dashboard)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir el shell visual de Kontify (dual-tier en escritorio, layout móvil, top bar, FAB, tema claro/oscuro) y el Dashboard con empty states, fiel a `docs/design/design-system.md` y cableado a los datos reales del Plan 1 (user/tenant/rol/sucursales/logout), reemplazando el `/dashboard` placeholder.

**Architecture:** Navegación dirigida por URL con `src/lib/nav.ts` como fuente de verdad de la IA (gateada por rol vía `canAccess` del Plan 1). Un route group `(app)` con un `layout.tsx` server que valida sesión e inyecta datos reales a un `AppShell` cliente. Desktop vs móvil se resuelve con clases responsive de Tailwind (breakpoint `lg`). Interactividad con Radix UI primitives vestidos con Tailwind. Componentes de dashboard presentacionales puros que reciben datos por props y muestran empty states.

**Tech Stack:** Next 16.2.10 (App Router, `proxy.ts`), React 19, Tailwind 4 (CSS-first, tokens en `globals.css`), Supabase (`@supabase/ssr`), `lucide-react`, `@radix-ui/react-{dropdown-menu,tooltip,dialog,popover}`, Vitest 4 (+ jsdom + `@testing-library/react` para tests de componentes).

---

## Convenciones de este plan

- Rama de trabajo: `feat/fundacion-plan-2` desde `master`.
- Supabase local debe estar corriendo (`npx supabase status`); si no, `npx supabase start`.
- Los colores se aplican con las variables CSS del Plan 1 (`var(--bg|surface|border|text|text-soft)`) y las utilidades de marca de Tailwind 4 (`bg-brand`, `text-brand`, etc.) definidas en `src/app/globals.css`.
- Todos los componentes interactivos llevan `"use client"`. Los `page.tsx`/`layout.tsx` que consultan Supabase son server components (sin `"use client"`).
- Iconos: `lucide-react`, `strokeWidth={2}`.

---

## Estructura de archivos

```
src/
├── lib/
│   ├── nav.ts                      # IA + navForRole/configForRole/resolveActiveSection
│   ├── nav.test.ts
│   ├── theme.ts                    # localStorage + aplicar clase .dark
│   └── theme.test.ts
├── components/
│   ├── ui/
│   │   ├── dropdown-menu.tsx        # wrapper Radix DropdownMenu
│   │   ├── tooltip.tsx              # wrapper Radix Tooltip
│   │   ├── sheet.tsx                # wrapper Radix Dialog (hoja lateral/inferior)
│   │   ├── popover.tsx              # wrapper Radix Popover
│   │   └── theme-toggle.tsx         # botón sol/luna
│   ├── shared/
│   │   ├── empty-state.tsx
│   │   ├── empty-state.test.tsx
│   │   └── module-placeholder.tsx
│   ├── shell/
│   │   ├── app-shell.tsx            # orquesta desktop/móvil + colapso panel
│   │   ├── rail.tsx                 # nivel-1
│   │   ├── subnav.tsx               # nivel-2
│   │   ├── topbar.tsx               # top bar escritorio
│   │   ├── fab-vender.tsx           # FAB squircle
│   │   ├── mobile-bottom-nav.tsx
│   │   └── mobile-more-sheet.tsx
│   └── dashboard/
│       ├── kpi-card.tsx
│       ├── kpi-card.test.tsx
│       ├── chart-card.tsx
│       ├── attention-list.tsx
│       └── period-selector.tsx
└── app/
    ├── layout.tsx                   # +script anti-FOUC, lang="es"
    ├── page.tsx                     # redirect → /dashboard
    ├── (app)/
    │   ├── layout.tsx               # server: sesión + user/tenant/rol/branches → AppShell
    │   ├── dashboard/page.tsx
    │   ├── notificaciones/page.tsx
    │   ├── actividad/page.tsx
    │   ├── clientes/page.tsx
    │   ├── clientes/nuevo/page.tsx
    │   ├── operaciones/{productos,facturacion,presupuestos}/page.tsx
    │   ├── reportes/{inventario,ventas}/page.tsx
    │   ├── finanzas/{cuentas-por-pagar,cuentas-por-cobrar,comisiones,bancos,gastos}/page.tsx
    │   └── configuracion/{sucursales,usuarios,preferencias}/page.tsx
    └── (auth)/
        ├── layout.tsx               # auth-layout de marca
        ├── login/page.tsx           # re-vestido (lógica intacta)
        └── registro/page.tsx        # re-vestido (lógica intacta)
```

---

## Task 0: Prerequisitos

- [ ] **Step 1: Crear la rama de trabajo desde master**

Run:
```bash
cd ~/admin-saas
git checkout master && git pull --ff-only 2>/dev/null; git checkout -b feat/fundacion-plan-2
```
Expected: en `feat/fundacion-plan-2`.

- [ ] **Step 2: Asegurar Supabase local corriendo y build base limpio**

Run:
```bash
npx supabase status >/dev/null 2>&1 || npx supabase start
npm run build
```
Expected: build OK (dashboard placeholder actual compila).

---

## Task 1: Instalar dependencias

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: Instalar librerías de runtime y de test**

Run:
```bash
npm i lucide-react @radix-ui/react-dropdown-menu @radix-ui/react-tooltip @radix-ui/react-dialog @radix-ui/react-popover
npm i -D jsdom @testing-library/react @testing-library/dom
```
Expected: instalación sin errores.

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: deps del shell (lucide-react + radix + testing-library)"
```

---

## Task 2: `nav.ts` — IA como fuente de verdad (TDD)

**Files:**
- Create: `src/lib/nav.ts`
- Test: `src/lib/nav.test.ts`

- [ ] **Step 1: Escribir el test que falla**

`src/lib/nav.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { NAV, navForRole, configForRole, resolveActiveSection } from "@/lib/nav";

describe("nav estructura", () => {
  it("tiene las 5 secciones de la IA en orden", () => {
    expect(NAV.map((s) => s.id)).toEqual(["inicio", "clientes", "operaciones", "reportes", "finanzas"]);
  });
  it("Inicio empieza en Dashboard", () => {
    expect(NAV[0].children[0].href).toBe("/dashboard");
  });
});

describe("navForRole", () => {
  it("owner ve las 5 secciones", () => {
    expect(navForRole("owner")).toHaveLength(5);
  });
  it("almacen solo ve Inicio y Operaciones", () => {
    expect(navForRole("almacen").map((s) => s.id)).toEqual(["inicio", "operaciones"]);
  });
  it("vendedor ve Inicio, Clientes y Operaciones", () => {
    expect(navForRole("vendedor").map((s) => s.id)).toEqual(["inicio", "clientes", "operaciones"]);
  });
});

describe("configForRole", () => {
  it("owner ve las 3 opciones de Configuración", () => {
    expect(configForRole("owner")!.children).toHaveLength(3);
  });
  it("cajero solo ve Preferencias dentro de Configuración", () => {
    expect(configForRole("cajero")!.children.map((c) => c.label)).toEqual(["Preferencias"]);
  });
});

describe("resolveActiveSection", () => {
  it("resuelve la sección desde el pathname", () => {
    expect(resolveActiveSection("/dashboard")?.id).toBe("inicio");
    expect(resolveActiveSection("/operaciones/facturacion")?.id).toBe("operaciones");
    expect(resolveActiveSection("/configuracion/preferencias")?.id).toBe("config");
  });
  it("devuelve null si no hay match", () => {
    expect(resolveActiveSection("/desconocido")).toBeNull();
  });
});
```

- [ ] **Step 2: Ejecutar — debe fallar (módulo no existe)**

Run: `npm test -- src/lib/nav.test.ts`
Expected: FAIL "Cannot find module '@/lib/nav'".

- [ ] **Step 3: Implementar `nav.ts`**

`src/lib/nav.ts`:
```ts
import type { LucideIcon } from "lucide-react";
import {
  Home, LayoutDashboard, Bell, Activity, Users, UserPlus, Package, FileText,
  ClipboardList, BarChart3, Boxes, TrendingUp, Wallet, ArrowUpCircle, ArrowDownCircle,
  Percent, Landmark, Receipt, Settings, Building2, ShieldCheck, SlidersHorizontal,
} from "lucide-react";
import { canAccess, type Role, type Resource } from "@/lib/auth/roles";

export type NavLeaf = { label: string; href: string; icon: LucideIcon; resource?: Resource };
export type NavSection = { id: string; label: string; icon: LucideIcon; resource: Resource; children: NavLeaf[] };

export const NAV: NavSection[] = [
  { id: "inicio", label: "Inicio", icon: Home, resource: "operaciones", children: [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Notificaciones", href: "/notificaciones", icon: Bell },
    { label: "Actividad", href: "/actividad", icon: Activity },
  ]},
  { id: "clientes", label: "Clientes", icon: Users, resource: "clientes", children: [
    { label: "Todos los clientes", href: "/clientes", icon: Users },
    { label: "Nuevo cliente", href: "/clientes/nuevo", icon: UserPlus },
  ]},
  { id: "operaciones", label: "Operaciones", icon: Package, resource: "operaciones", children: [
    { label: "Productos", href: "/operaciones/productos", icon: Package },
    { label: "Facturación", href: "/operaciones/facturacion", icon: FileText },
    { label: "Presupuestos", href: "/operaciones/presupuestos", icon: ClipboardList },
  ]},
  { id: "reportes", label: "Reportes", icon: BarChart3, resource: "reportes", children: [
    { label: "Inventario", href: "/reportes/inventario", icon: Boxes },
    { label: "Ventas", href: "/reportes/ventas", icon: TrendingUp },
  ]},
  { id: "finanzas", label: "Finanzas", icon: Wallet, resource: "finanzas", children: [
    { label: "Cuentas por pagar", href: "/finanzas/cuentas-por-pagar", icon: ArrowUpCircle },
    { label: "Cuentas por cobrar", href: "/finanzas/cuentas-por-cobrar", icon: ArrowDownCircle },
    { label: "Comisiones", href: "/finanzas/comisiones", icon: Percent },
    { label: "Bancos", href: "/finanzas/bancos", icon: Landmark },
    { label: "Gastos", href: "/finanzas/gastos", icon: Receipt },
  ]},
];

// Configuración vive abajo del riel. La sección es visible a todos (para el toggle de tema
// en Preferencias), pero Sucursales/Usuarios se gatean a owner/admin con resource "billing".
export const CONFIG_SECTION: NavSection = {
  id: "config", label: "Configuración", icon: Settings, resource: "operaciones", children: [
    { label: "Sucursales", href: "/configuracion/sucursales", icon: Building2, resource: "billing" },
    { label: "Usuarios y roles", href: "/configuracion/usuarios", icon: ShieldCheck, resource: "billing" },
    { label: "Preferencias", href: "/configuracion/preferencias", icon: SlidersHorizontal },
  ],
};

const ALL_SECTIONS: NavSection[] = [...NAV, CONFIG_SECTION];

/** Filtra una sección y sus hijos por rol. Devuelve null si el rol no puede ver nada.
 *  Solo es UX (ocultar); la autorización real vive en RLS/endpoints. */
function filterSection(section: NavSection, role: Role): NavSection | null {
  if (!canAccess(role, section.resource)) return null;
  const children = section.children.filter((c) => !c.resource || canAccess(role, c.resource));
  return children.length ? { ...section, children } : null;
}

export function navForRole(role: Role): NavSection[] {
  return NAV.map((s) => filterSection(s, role)).filter((s): s is NavSection => s !== null);
}

export function configForRole(role: Role): NavSection | null {
  return filterSection(CONFIG_SECTION, role);
}

/** Sección nivel-1 activa derivada del pathname (o null). Gana el href más largo que casa. */
export function resolveActiveSection(pathname: string): NavSection | null {
  let best: { section: NavSection; len: number } | null = null;
  for (const section of ALL_SECTIONS) {
    for (const child of section.children) {
      if (pathname === child.href || pathname.startsWith(child.href + "/")) {
        if (!best || child.href.length > best.len) best = { section, len: child.href.length };
      }
    }
  }
  return best?.section ?? null;
}
```

- [ ] **Step 4: Ejecutar — debe pasar**

Run: `npm test -- src/lib/nav.test.ts`
Expected: PASS (todos).

- [ ] **Step 5: Commit**

```bash
git add src/lib/nav.ts src/lib/nav.test.ts
git commit -m "feat: nav.ts IA gateada por rol + resolución por pathname"
```

---

## Task 3: `theme.ts` + habilitar tests de componente (jsdom)

**Files:**
- Modify: `vitest.config.ts`
- Create: `src/lib/theme.ts`, `src/lib/theme.test.ts`

- [ ] **Step 1: Añadir el plugin de React a vitest (para JSX en tests de componente)**

Reemplazar `vitest.config.ts` por:
```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  // Entorno por defecto: node (tests de integración contra Supabase). Los tests de
  // componente/tema declaran jsdom por-archivo con `// @vitest-environment jsdom`.
  test: { environment: "node", testTimeout: 20000, fileParallelism: false },
});
```

- [ ] **Step 2: Escribir el test que falla**

`src/lib/theme.test.ts`:
```ts
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { getStoredTheme, resolveTheme, setTheme, toggleTheme } from "@/lib/theme";

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove("dark");
  // jsdom no implementa matchMedia: stub que reporta modo claro
  vi.stubGlobal("matchMedia", (q: string) => ({
    matches: false, media: q, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  }));
});

describe("theme", () => {
  it("sin preferencia guardada devuelve null", () => {
    expect(getStoredTheme()).toBeNull();
  });
  it("setTheme('dark') guarda y aplica la clase", () => {
    setTheme("dark");
    expect(getStoredTheme()).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
  it("resolveTheme cae al sistema (claro) sin preferencia", () => {
    expect(resolveTheme()).toBe("light");
  });
  it("toggleTheme alterna y persiste", () => {
    setTheme("light");
    expect(toggleTheme()).toBe("dark");
    expect(getStoredTheme()).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
});
```

- [ ] **Step 3: Ejecutar — debe fallar**

Run: `npm test -- src/lib/theme.test.ts`
Expected: FAIL "Cannot find module '@/lib/theme'".

- [ ] **Step 4: Implementar `theme.ts`**

`src/lib/theme.ts`:
```ts
export type Theme = "light" | "dark";
const KEY = "kontify-theme";

export function getStoredTheme(): Theme | null {
  const v = localStorage.getItem(KEY);
  return v === "light" || v === "dark" ? v : null;
}

export function systemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function resolveTheme(): Theme {
  return getStoredTheme() ?? systemTheme();
}

export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function setTheme(theme: Theme): void {
  localStorage.setItem(KEY, theme);
  applyTheme(theme);
}

export function toggleTheme(): Theme {
  const next: Theme = resolveTheme() === "dark" ? "light" : "dark";
  setTheme(next);
  return next;
}
```

- [ ] **Step 5: Ejecutar — debe pasar; y la suite del Plan 1 sigue verde**

Run: `npm test`
Expected: PASS en nav, theme, roles, bootstrap, rls (todo verde).

- [ ] **Step 6: Commit**

```bash
git add vitest.config.ts src/lib/theme.ts src/lib/theme.test.ts
git commit -m "feat: theme.ts (localStorage + clase .dark) + vitest jsdom por-archivo"
```

---

## Task 4: Script anti-FOUC de tema en el root layout

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Reescribir el root layout con lang=es y el script inline**

`src/app/layout.tsx`:
```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kontify",
  description: "Gestión administrativa para tu negocio",
};

// Aplica el tema ANTES de pintar para evitar el parpadeo claro→oscuro (FOUC).
const themeScript = `(function(){try{var t=localStorage.getItem('kontify-theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}if(t==='dark'){document.documentElement.classList.add('dark');}}catch(e){}})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className="h-full antialiased" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
```

- [ ] **Step 2: Verificar build**

Run: `npm run build`
Expected: build OK.

- [ ] **Step 3: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat: root layout es + script anti-FOUC de tema"
```

---

## Task 5: Componentes compartidos (empty-state + module-placeholder)

**Files:**
- Create: `src/components/shared/empty-state.tsx`, `src/components/shared/empty-state.test.tsx`, `src/components/shared/module-placeholder.tsx`

- [ ] **Step 1: Escribir el test que falla**

`src/components/shared/empty-state.test.tsx`:
```tsx
// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Inbox } from "lucide-react";
import { EmptyState } from "./empty-state";

describe("EmptyState", () => {
  it("muestra título y pista", () => {
    render(<EmptyState icon={Inbox} title="Sin datos aún" hint="Vuelve pronto" />);
    expect(screen.getByText("Sin datos aún")).toBeTruthy();
    expect(screen.getByText("Vuelve pronto")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Ejecutar — debe fallar**

Run: `npm test -- src/components/shared/empty-state.test.tsx`
Expected: FAIL "Cannot find module './empty-state'".

- [ ] **Step 3: Implementar `empty-state.tsx`**

`src/components/shared/empty-state.tsx`:
```tsx
import type { LucideIcon } from "lucide-react";

export function EmptyState({ icon: Icon, title, hint }: { icon: LucideIcon; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <div className="grid h-11 w-11 place-items-center rounded-xl border border-[var(--border)] bg-[var(--bg)]">
        <Icon className="h-5 w-5 text-[var(--text-soft)]" strokeWidth={2} />
      </div>
      <p className="text-sm font-semibold text-[var(--text)]">{title}</p>
      {hint && <p className="text-xs text-[var(--text-soft)]">{hint}</p>}
    </div>
  );
}
```

- [ ] **Step 4: Ejecutar — debe pasar**

Run: `npm test -- src/components/shared/empty-state.test.tsx`
Expected: PASS.

- [ ] **Step 5: Implementar `module-placeholder.tsx`**

`src/components/shared/module-placeholder.tsx`:
```tsx
import type { LucideIcon } from "lucide-react";
import { Hammer } from "lucide-react";
import { EmptyState } from "./empty-state";

export function ModulePlaceholder({ title, icon }: { title: string; icon?: LucideIcon }) {
  return (
    <div className="p-6">
      <h1 className="text-xl font-extrabold tracking-[-0.4px] text-[var(--text)]">{title}</h1>
      <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        <EmptyState icon={icon ?? Hammer} title="Este módulo llega pronto"
          hint="Lo estamos construyendo. Llegará en una próxima versión de Kontify." />
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add src/components/shared
git commit -m "feat: EmptyState + ModulePlaceholder (con test)"
```

---

## Task 6: Wrappers Radix (dropdown, tooltip, sheet, popover)

**Files:**
- Create: `src/components/ui/dropdown-menu.tsx`, `src/components/ui/tooltip.tsx`, `src/components/ui/sheet.tsx`, `src/components/ui/popover.tsx`

- [ ] **Step 1: `dropdown-menu.tsx`**

```tsx
"use client";
import * as DM from "@radix-ui/react-dropdown-menu";
import type { ReactNode } from "react";

export function DropdownMenu({ trigger, children, align = "end" }: {
  trigger: ReactNode; children: ReactNode; align?: "start" | "center" | "end";
}) {
  return (
    <DM.Root>
      <DM.Trigger asChild>{trigger}</DM.Trigger>
      <DM.Portal>
        <DM.Content align={align} sideOffset={8}
          className="z-50 min-w-52 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-lg">
          {children}
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  );
}

export function DropdownItem({ children, onSelect }: { children: ReactNode; onSelect?: () => void }) {
  return (
    <DM.Item onSelect={onSelect}
      className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-[var(--text)] outline-none data-[highlighted]:bg-[var(--bg)]">
      {children}
    </DM.Item>
  );
}

export function DropdownLabel({ children }: { children: ReactNode }) {
  return <DM.Label className="px-2.5 py-1.5 text-xs font-semibold text-[var(--text-soft)]">{children}</DM.Label>;
}

export function DropdownSeparator() {
  return <DM.Separator className="my-1 h-px bg-[var(--border)]" />;
}
```

- [ ] **Step 2: `tooltip.tsx`**

```tsx
"use client";
import * as TP from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";

export function Tooltip({ label, children, side = "right" }: {
  label: string; children: ReactNode; side?: "top" | "right" | "bottom" | "left";
}) {
  return (
    <TP.Provider delayDuration={200}>
      <TP.Root>
        <TP.Trigger asChild>{children}</TP.Trigger>
        <TP.Portal>
          <TP.Content side={side} sideOffset={8}
            className="z-50 rounded-md bg-[#0f172a] px-2 py-1 text-xs font-medium text-white shadow-md">
            {label}
            <TP.Arrow className="fill-[#0f172a]" />
          </TP.Content>
        </TP.Portal>
      </TP.Root>
    </TP.Provider>
  );
}
```

- [ ] **Step 3: `sheet.tsx`** (usa Radix Dialog; `side` decide de qué borde entra)

```tsx
"use client";
import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";

export function Sheet({ open, onOpenChange, side = "bottom", title, children }: {
  open: boolean; onOpenChange: (o: boolean) => void; side?: "bottom" | "right";
  title: string; children: ReactNode;
}) {
  const pos = side === "bottom"
    ? "inset-x-0 bottom-0 max-h-[85vh] rounded-t-2xl"
    : "inset-y-0 right-0 w-[88vw] max-w-sm rounded-l-2xl";
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content
          className={`fixed z-50 overflow-y-auto border border-[var(--border)] bg-[var(--surface)] p-4 ${pos}`}>
          <Dialog.Title className="mb-3 text-base font-bold text-[var(--text)]">{title}</Dialog.Title>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

- [ ] **Step 4: `popover.tsx`**

```tsx
"use client";
import * as PO from "@radix-ui/react-popover";
import type { ReactNode } from "react";

export function Popover({ trigger, children, align = "end" }: {
  trigger: ReactNode; children: ReactNode; align?: "start" | "center" | "end";
}) {
  return (
    <PO.Root>
      <PO.Trigger asChild>{trigger}</PO.Trigger>
      <PO.Portal>
        <PO.Content align={align} sideOffset={8}
          className="z-50 w-80 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-lg">
          {children}
        </PO.Content>
      </PO.Portal>
    </PO.Root>
  );
}
```

- [ ] **Step 5: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/dropdown-menu.tsx src/components/ui/tooltip.tsx src/components/ui/sheet.tsx src/components/ui/popover.tsx
git commit -m "feat: wrappers Radix (dropdown, tooltip, sheet, popover) con tokens Teal & Slate"
```

---

## Task 7: `theme-toggle.tsx`

**Files:**
- Create: `src/components/ui/theme-toggle.tsx`

- [ ] **Step 1: Implementar**

`src/components/ui/theme-toggle.tsx`:
```tsx
"use client";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { resolveTheme, toggleTheme, type Theme } from "@/lib/theme";

export function ThemeToggle({ withLabel = false }: { withLabel?: boolean }) {
  const [theme, setThemeState] = useState<Theme>("light");
  useEffect(() => { setThemeState(resolveTheme()); }, []);

  function onClick() { setThemeState(toggleTheme()); }
  const Icon = theme === "dark" ? Sun : Moon;
  const label = theme === "dark" ? "Modo claro" : "Modo oscuro";

  return (
    <button type="button" onClick={onClick} aria-label={label}
      className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-[var(--text)] hover:bg-[var(--bg)]">
      <Icon className="h-4 w-4" strokeWidth={2} />
      {withLabel && <span>{label}</span>}
    </button>
  );
}
```

- [ ] **Step 2: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/theme-toggle.tsx
git commit -m "feat: ThemeToggle sol/luna"
```

---

## Task 8: Tipos compartidos del shell + `rail.tsx` (riel nivel-1)

**Files:**
- Create: `src/components/shell/types.ts`, `src/components/shell/rail.tsx`

- [ ] **Step 1: Crear los tipos compartidos del shell**

`src/components/shell/types.ts`:
```ts
import type { Role } from "@/lib/auth/roles";

export type ShellUser = { email: string; fullName: string; initial: string; role: Role; roleLabel: string };
export type ShellBranch = { id: string; name: string };
```

- [ ] **Step 2: Implementar el riel**

`src/components/shell/rail.tsx`:
```tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavSection } from "@/lib/nav";
import { resolveActiveSection } from "@/lib/nav";
import { Tooltip } from "@/components/ui/tooltip";

export function Rail({ sections, config }: { sections: NavSection[]; config: NavSection | null }) {
  const pathname = usePathname();
  const activeId = resolveActiveSection(pathname)?.id;

  const Tile = ({ section }: { section: NavSection }) => {
    const active = section.id === activeId;
    const Icon = section.icon;
    return (
      <Tooltip label={section.label}>
        <Link href={section.children[0].href} aria-label={section.label}
          className={`grid h-11 w-11 place-items-center rounded-xl transition ${
            active ? "bg-gradient-to-br from-[#0e7490] to-[#14b8a6] text-white shadow-[0_0_16px_rgba(20,184,166,0.5)]"
                   : "text-slate-400 hover:bg-white/5 hover:text-white"}`}>
          <Icon className="h-5 w-5" strokeWidth={2} />
        </Link>
      </Tooltip>
    );
  };

  return (
    <nav className="flex h-full w-[72px] flex-col items-center gap-2 bg-[#0f172a] py-4">
      <div className="mb-2 grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-[#0e7490] to-[#14b8a6] text-sm font-black text-white">K</div>
      {sections.map((s) => <Tile key={s.id} section={s} />)}
      <div className="mt-auto flex flex-col items-center gap-2">
        {config && <Tile section={config} />}
      </div>
    </nav>
  );
}
```

- [ ] **Step 3: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/components/shell/types.ts src/components/shell/rail.tsx
git commit -m "feat: tipos del shell + Rail nivel-1 (72px, tiles gradiente + tooltips)"
```

---

## Task 9: `subnav.tsx` — panel nivel-2

**Files:**
- Create: `src/components/shell/subnav.tsx`

- [ ] **Step 1: Implementar**

`src/components/shell/subnav.tsx`:
```tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavSection } from "@/lib/nav";
import { resolveActiveSection } from "@/lib/nav";

export function SubNav({ sections, config, collapsed }: {
  sections: NavSection[]; config: NavSection | null; collapsed: boolean;
}) {
  const pathname = usePathname();
  const active = resolveActiveSection(pathname) ?? sections[0] ?? config;
  if (!active) return null;

  return (
    <aside
      className="h-full overflow-hidden border-r border-[var(--border)] bg-[var(--surface)] transition-[width] duration-[280ms]"
      style={{ width: collapsed ? 0 : 236 }}>
      <div className="w-[236px] p-3">
        <p className="px-2 pb-2 pt-1 text-xs font-bold uppercase tracking-wide text-[var(--text-soft)]">{active.label}</p>
        <ul className="space-y-1">
          {active.children.map((child) => {
            const on = pathname === child.href || pathname.startsWith(child.href + "/");
            const Icon = child.icon;
            return (
              <li key={child.href}>
                <Link href={child.href}
                  className={`relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition ${
                    on ? "bg-[#e6f7f4] font-semibold text-[#0e7490] dark:bg-[#0e7490]/15 dark:text-[#5eead4]"
                       : "text-[var(--text)] hover:bg-[var(--bg)]"}`}>
                  {on && <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r bg-[#0e7490] dark:bg-[#5eead4]" />}
                  <Icon className="h-4 w-4" strokeWidth={2} />
                  {child.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/components/shell/subnav.tsx
git commit -m "feat: SubNav nivel-2 (236px, colapsable, ítem activo con barra de acento)"
```

---

## Task 10: `topbar.tsx` — top bar de escritorio

**Files:**
- Create: `src/components/shell/topbar.tsx`

- [ ] **Step 1: Implementar**

`src/components/shell/topbar.tsx`:
```tsx
"use client";
import { PanelLeft, Search, Store, Bell, ChevronDown, User, LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { DropdownMenu, DropdownItem, DropdownLabel, DropdownSeparator } from "@/components/ui/dropdown-menu";
import { Popover } from "@/components/ui/popover";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { EmptyState } from "@/components/shared/empty-state";
import type { ShellUser } from "@/components/shell/types";

export function TopBar({ user, branches, onToggle }: {
  user: ShellUser; branches: { id: string; name: string }[]; onToggle: () => void;
}) {
  async function signOut() {
    await createClient().auth.signOut();
    window.location.href = "/login";
  }
  return (
    <header className="flex h-14 items-center gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-4">
      <button onClick={onToggle} aria-label="Alternar panel"
        className="grid h-9 w-9 place-items-center rounded-lg text-[var(--text-soft)] hover:bg-[var(--bg)]">
        <PanelLeft className="h-5 w-5" strokeWidth={2} />
      </button>

      <div className="flex h-9 flex-1 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 text-[var(--text-soft)]">
        <Search className="h-4 w-4" strokeWidth={2} />
        <input placeholder="Buscar…" className="w-full bg-transparent text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-soft)]" />
      </div>

      <DropdownMenu trigger={
        <button className="flex h-9 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 text-sm text-[var(--text)]">
          <Store className="h-4 w-4" strokeWidth={2} /> Todas <ChevronDown className="h-3.5 w-3.5" />
        </button>}>
        <DropdownLabel>Sucursal</DropdownLabel>
        <DropdownItem>Todas (consolidado)</DropdownItem>
        {branches.map((b) => <DropdownItem key={b.id}>{b.name}</DropdownItem>)}
      </DropdownMenu>

      <Popover trigger={
        <button aria-label="Notificaciones" className="relative grid h-9 w-9 place-items-center rounded-lg text-[var(--text-soft)] hover:bg-[var(--bg)]">
          <Bell className="h-5 w-5" strokeWidth={2} />
        </button>}>
        <p className="mb-2 text-sm font-bold text-[var(--text)]">Notificaciones</p>
        <EmptyState icon={Bell} title="Sin novedades" hint="Aquí verás alertas de stock, pagos y ventas." />
      </Popover>

      <DropdownMenu trigger={
        <button aria-label="Cuenta" className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-[#0e7490] to-[#14b8a6] text-sm font-bold text-white">
          {user.initial}
        </button>}>
        <DropdownLabel>{user.fullName || user.email}</DropdownLabel>
        <DropdownLabel>{user.roleLabel}</DropdownLabel>
        <DropdownSeparator />
        <div className="px-1"><ThemeToggle withLabel /></div>
        <DropdownItem><Link href="/configuracion/preferencias" className="flex items-center gap-2"><Settings className="h-4 w-4" /> Configuración</Link></DropdownItem>
        <DropdownSeparator />
        <DropdownItem onSelect={signOut}><LogOut className="h-4 w-4" /> Cerrar sesión</DropdownItem>
      </DropdownMenu>
    </header>
  );
}
```

- [ ] **Step 2: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores (`ShellUser` ya existe en `shell/types.ts`).

- [ ] **Step 3: Commit**

```bash
git add src/components/shell/topbar.tsx
git commit -m "feat: TopBar (toggle, buscador visual, selector sucursal, notif, avatar+logout)"
```

---

## Task 11: `fab-vender.tsx` — FAB squircle

**Files:**
- Create: `src/components/shell/fab-vender.tsx`

- [ ] **Step 1: Implementar**

`src/components/shell/fab-vender.tsx`:
```tsx
"use client";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

export function FabVender() {
  const router = useRouter();
  // Acción placeholder: la venta rápida real llega con el módulo de Facturación.
  return (
    <button aria-label="Vender" onClick={() => router.push("/operaciones/facturacion")}
      className="fixed bottom-6 right-6 z-40 hidden h-14 w-14 place-items-center bg-gradient-to-br from-[#0e7490] to-[#14b8a6] text-white shadow-xl transition hover:scale-105 lg:grid"
      style={{ borderRadius: "40%" }}>
      <Plus className="h-7 w-7" strokeWidth={2.5} />
    </button>
  );
}
```

- [ ] **Step 2: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos (salvo el `ShellUser` pendiente de Task 13).

- [ ] **Step 3: Commit**

```bash
git add src/components/shell/fab-vender.tsx
git commit -m "feat: FAB Vender (squircle gradiente, solo escritorio)"
```

---

## Task 12: Navegación móvil (barra inferior + hoja "Más")

**Files:**
- Create: `src/components/shell/mobile-bottom-nav.tsx`, `src/components/shell/mobile-more-sheet.tsx`

- [ ] **Step 1: `mobile-more-sheet.tsx`**

```tsx
"use client";
import Link from "next/link";
import { Store, Settings, FileText, BarChart3, Wallet, HelpCircle, LogOut } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { createClient } from "@/lib/supabase/client";
import type { ShellUser } from "@/components/shell/types";

const GROUPS = [
  { title: "Cuenta", items: [
    { label: "Cambiar sucursal", href: "/configuracion/sucursales", icon: Store },
    { label: "Configuración", href: "/configuracion/preferencias", icon: Settings },
  ]},
  { title: "Módulos", items: [
    { label: "Presupuestos", href: "/operaciones/presupuestos", icon: FileText },
    { label: "Reportes", href: "/reportes/inventario", icon: BarChart3 },
    { label: "Finanzas", href: "/finanzas/cuentas-por-cobrar", icon: Wallet },
  ]},
  { title: "Otros", items: [
    { label: "Ayuda", href: "/configuracion/preferencias", icon: HelpCircle },
  ]},
];

export function MobileMoreSheet({ open, onOpenChange, user }: {
  open: boolean; onOpenChange: (o: boolean) => void; user: ShellUser;
}) {
  async function signOut() { await createClient().auth.signOut(); window.location.href = "/login"; }
  return (
    <Sheet open={open} onOpenChange={onOpenChange} side="bottom" title="Más">
      <div className="mb-4 flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3">
        <div className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-[#0e7490] to-[#14b8a6] text-base font-bold text-white">{user.initial}</div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-[var(--text)]">{user.fullName || user.email}</p>
          <p className="text-xs text-[var(--text-soft)]">{user.roleLabel}</p>
        </div>
        <Link href="/configuracion/preferencias" onClick={() => onOpenChange(false)} className="ml-auto text-xs font-semibold text-[#0e7490] dark:text-[#5eead4]">Ver perfil</Link>
      </div>
      {GROUPS.map((g) => (
        <div key={g.title} className="mb-4">
          <p className="mb-1 px-1 text-xs font-semibold text-[var(--text-soft)]">{g.title}</p>
          <ul className="space-y-1">
            {g.items.map((it) => {
              const Icon = it.icon;
              return (
                <li key={it.label}>
                  <Link href={it.href} onClick={() => onOpenChange(false)}
                    className="flex items-center gap-3 rounded-lg px-2.5 py-2.5 text-sm text-[var(--text)] hover:bg-[var(--bg)]">
                    <Icon className="h-4 w-4" strokeWidth={2} /> {it.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      <button onClick={signOut} className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-sm font-semibold text-[#dc2626] hover:bg-[var(--bg)]">
        <LogOut className="h-4 w-4" strokeWidth={2} /> Cerrar sesión
      </button>
    </Sheet>
  );
}
```

- [ ] **Step 2: `mobile-bottom-nav.tsx`**

```tsx
"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, ShoppingCart, Plus, Boxes, Menu } from "lucide-react";
import { MobileMoreSheet } from "@/components/shell/mobile-more-sheet";
import type { ShellUser } from "@/components/shell/types";

export function MobileBottomNav({ user }: { user: ShellUser }) {
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);

  const Item = ({ href, icon: Icon, label }: { href: string; icon: typeof Home; label: string }) => {
    const on = pathname === href || pathname.startsWith(href + "/");
    return (
      <Link href={href} className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium ${on ? "text-[#0e7490] dark:text-[#5eead4]" : "text-[var(--text-soft)]"}`}>
        <Icon className="h-5 w-5" strokeWidth={2} /> {label}
      </Link>
    );
  };

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 flex items-end border-t border-[var(--border)] bg-[var(--surface)] px-2 lg:hidden">
        <Item href="/dashboard" icon={Home} label="Inicio" />
        <Item href="/reportes/ventas" icon={ShoppingCart} label="Vender" />
        <button aria-label="Vender" onClick={() => router.push("/operaciones/facturacion")}
          className="-mt-5 grid h-[46px] w-[46px] flex-none place-items-center bg-gradient-to-br from-[#0e7490] to-[#14b8a6] text-white shadow-lg"
          style={{ borderRadius: 22 }}>
          <Plus className="h-6 w-6" strokeWidth={2.5} />
        </button>
        <Item href="/reportes/inventario" icon={Boxes} label="Inventario" />
        <button onClick={() => setMoreOpen(true)} className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium text-[var(--text-soft)]">
          <Menu className="h-5 w-5" strokeWidth={2} /> Más
        </button>
      </nav>
      <MobileMoreSheet open={moreOpen} onOpenChange={setMoreOpen} user={user} />
    </>
  );
}
```

- [ ] **Step 3: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos (salvo `ShellUser` de Task 13).

- [ ] **Step 4: Commit**

```bash
git add src/components/shell/mobile-bottom-nav.tsx src/components/shell/mobile-more-sheet.tsx
git commit -m "feat: navegación móvil (barra inferior + squircle + hoja Más con perfil)"
```

---

## Task 13: `app-shell.tsx` — orquestador (dual-tier/móvil + colapso)

**Files:**
- Create: `src/components/shell/app-shell.tsx`

- [ ] **Step 1: Implementar**

`src/components/shell/app-shell.tsx`:
```tsx
"use client";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Store, Bell, ChevronDown } from "lucide-react";
import { navForRole, configForRole } from "@/lib/nav";
import { Rail } from "@/components/shell/rail";
import { SubNav } from "@/components/shell/subnav";
import { TopBar } from "@/components/shell/topbar";
import { FabVender } from "@/components/shell/fab-vender";
import { MobileBottomNav } from "@/components/shell/mobile-bottom-nav";
import { DropdownMenu, DropdownItem, DropdownLabel } from "@/components/ui/dropdown-menu";
import { Popover } from "@/components/ui/popover";
import { EmptyState } from "@/components/shared/empty-state";
import type { ShellUser, ShellBranch } from "@/components/shell/types";

export type { ShellUser, ShellBranch } from "@/components/shell/types";

const COLLAPSE_KEY = "kontify-panel-collapsed";

export function AppShell({ user, branches, children }: {
  user: ShellUser; branches: ShellBranch[]; children: ReactNode;
}) {
  const sections = navForRole(user.role);
  const config = configForRole(user.role);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => { setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1"); }, []);
  function toggle() {
    setCollapsed((c) => { const n = !c; localStorage.setItem(COLLAPSE_KEY, n ? "1" : "0"); return n; });
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg)]">
      {/* Escritorio: dual-tier */}
      <div className="hidden lg:flex"><Rail sections={sections} config={config} /></div>
      <div className="hidden lg:block"><SubNav sections={sections} config={config} collapsed={collapsed} /></div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="hidden lg:block"><TopBar user={user} branches={branches} onToggle={toggle} /></div>

        {/* Top bar móvil: selector de sucursal + campana (design-system §6, sin avatar) */}
        <div className="flex h-14 items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--surface)] px-4 lg:hidden">
          <DropdownMenu align="start" trigger={
            <button className="flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2.5 text-sm text-[var(--text)]">
              <Store className="h-4 w-4" strokeWidth={2} /> Todas <ChevronDown className="h-3.5 w-3.5" />
            </button>}>
            <DropdownLabel>Sucursal</DropdownLabel>
            <DropdownItem>Todas (consolidado)</DropdownItem>
            {branches.map((b) => <DropdownItem key={b.id}>{b.name}</DropdownItem>)}
          </DropdownMenu>
          <Popover trigger={
            <button aria-label="Notificaciones" className="grid h-9 w-9 place-items-center rounded-lg text-[var(--text-soft)] hover:bg-[var(--bg)]">
              <Bell className="h-5 w-5" strokeWidth={2} />
            </button>}>
            <p className="mb-2 text-sm font-bold text-[var(--text)]">Notificaciones</p>
            <EmptyState icon={Bell} title="Sin novedades" hint="Aquí verás alertas de stock, pagos y ventas." />
          </Popover>
        </div>

        <main className="flex-1 overflow-y-auto pb-20 lg:pb-0">{children}</main>
      </div>

      <FabVender />
      <MobileBottomNav user={user} />
    </div>
  );
}
```

- [ ] **Step 2: Verificar typecheck (ahora todo el shell resuelve)**

Run: `npx tsc --noEmit`
Expected: sin errores (los imports de `ShellUser` en topbar/mobile ya resuelven).

- [ ] **Step 3: Commit**

```bash
git add src/components/shell/app-shell.tsx
git commit -m "feat: AppShell orquesta dual-tier/móvil + persistencia de colapso"
```

---

## Task 14: Route group `(app)` — layout server + mover dashboard + root redirect

**Files:**
- Create: `src/app/(app)/layout.tsx`
- Move: `src/app/dashboard/page.tsx` → `src/app/(app)/dashboard/page.tsx` (se reescribe en Task 17)
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Crear el layout server del grupo `(app)`**

`src/app/(app)/layout.tsx`:
```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell, type ShellUser, type ShellBranch } from "@/components/shell/app-shell";
import type { Role } from "@/lib/auth/roles";

const ROLE_LABEL: Record<Role, string> = {
  owner: "Propietario", admin: "Administrador", administrativo: "Administrativo",
  vendedor: "Vendedor", cajero: "Cajero", almacen: "Almacén",
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // profiles y memberships NO tienen FK directa entre sí (ambas referencian auth.users),
  // así que se consultan por separado; RLS ya limita ambas al tenant del usuario.
  const { data: membership } = await supabase.from("memberships").select("role").single();
  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
  const { data: branches } = await supabase.from("branches").select("id, name").order("is_main", { ascending: false });

  const role = (membership?.role ?? "vendedor") as Role;
  const fullName = profile?.full_name ?? "";
  const shellUser: ShellUser = {
    email: user.email ?? "",
    fullName,
    initial: (fullName || user.email || "K").trim().charAt(0).toUpperCase(),
    role,
    roleLabel: ROLE_LABEL[role],
  };
  const shellBranches: ShellBranch[] = (branches ?? []) as ShellBranch[];

  return <AppShell user={shellUser} branches={shellBranches}>{children}</AppShell>;
}
```

- [ ] **Step 2: Mover el dashboard placeholder al grupo `(app)`**

Run:
```bash
mkdir -p "src/app/(app)/dashboard"
git mv src/app/dashboard/page.tsx "src/app/(app)/dashboard/page.tsx"
rmdir src/app/dashboard 2>/dev/null || true
```
Expected: el archivo queda en `(app)/dashboard/page.tsx` (se reescribe en Task 17; la ruta `/dashboard` no cambia porque `(app)` es un route group).

- [ ] **Step 3: Root redirect a /dashboard**

Reemplazar `src/app/page.tsx` por:
```tsx
import { redirect } from "next/navigation";
export default function Home() { redirect("/dashboard"); }
```

- [ ] **Step 4: Verificar build**

Run: `npm run build`
Expected: build OK. `/` redirige; `/dashboard` protegido dentro del shell.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/layout.tsx" "src/app/(app)/dashboard/page.tsx" src/app/page.tsx
git commit -m "feat: route group (app) con layout server (sesión+datos reales) + root redirect"
```

---

## Task 15: Páginas placeholder de todas las rutas del menú

**Files:**
- Create: `src/app/(app)/{notificaciones,actividad,clientes}/page.tsx`, `src/app/(app)/clientes/nuevo/page.tsx`, `src/app/(app)/operaciones/{productos,facturacion,presupuestos}/page.tsx`, `src/app/(app)/reportes/{inventario,ventas}/page.tsx`, `src/app/(app)/finanzas/{cuentas-por-pagar,cuentas-por-cobrar,comisiones,bancos,gastos}/page.tsx`, `src/app/(app)/configuracion/{sucursales,usuarios,preferencias}/page.tsx`

- [ ] **Step 1: Generar las páginas placeholder con un script**

Run:
```bash
cd ~/admin-saas
gen() { # $1 = ruta relativa a (app), $2 = título
  local dir="src/app/(app)/$1"; mkdir -p "$dir"
  cat > "$dir/page.tsx" <<EOF
import { ModulePlaceholder } from "@/components/shared/module-placeholder";
export default function Page() { return <ModulePlaceholder title="$2" />; }
EOF
}
gen notificaciones "Notificaciones"
gen actividad "Actividad"
gen clientes "Clientes"
gen clientes/nuevo "Nuevo cliente"
gen operaciones/productos "Productos"
gen operaciones/facturacion "Facturación"
gen operaciones/presupuestos "Presupuestos"
gen reportes/inventario "Inventario"
gen reportes/ventas "Ventas"
gen finanzas/cuentas-por-pagar "Cuentas por pagar"
gen finanzas/cuentas-por-cobrar "Cuentas por cobrar"
gen finanzas/comisiones "Comisiones"
gen finanzas/bancos "Bancos"
gen finanzas/gastos "Gastos"
gen configuracion/sucursales "Sucursales"
gen configuracion/usuarios "Usuarios y roles"
echo "listo"
```
Expected: imprime "listo" y crea 16 páginas.

- [ ] **Step 2: Página Preferencias con el toggle de tema funcional**

`src/app/(app)/configuracion/preferencias/page.tsx`:
```tsx
import { ThemeToggle } from "@/components/ui/theme-toggle";

export default function Preferencias() {
  return (
    <div className="p-6">
      <h1 className="text-xl font-extrabold tracking-[-0.4px] text-[var(--text)]">Preferencias</h1>
      <div className="mt-4 max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-[var(--text)]">Tema</p>
            <p className="text-xs text-[var(--text-soft)]">Claro u oscuro. Se recuerda en este dispositivo.</p>
          </div>
          <ThemeToggle withLabel />
        </div>
        <p className="mt-4 text-xs text-[var(--text-soft)]">Más preferencias llegan pronto.</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verificar build**

Run: `npm run build`
Expected: build OK; todas las rutas del menú existen (nada da 404).

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)"
git commit -m "feat: páginas placeholder de todo el menú + Preferencias con toggle de tema"
```

---

## Task 16: Componentes de dashboard (kpi-card TDD + chart-card + attention-list + period-selector)

**Files:**
- Create: `src/components/dashboard/kpi-card.tsx`, `src/components/dashboard/kpi-card.test.tsx`, `src/components/dashboard/chart-card.tsx`, `src/components/dashboard/attention-list.tsx`, `src/components/dashboard/period-selector.tsx`

- [ ] **Step 1: Test que falla para `KpiCard`**

`src/components/dashboard/kpi-card.test.tsx`:
```tsx
// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Wallet } from "lucide-react";
import { KpiCard } from "./kpi-card";

describe("KpiCard", () => {
  it("muestra el valor cuando hay datos", () => {
    render(<KpiCard icon={Wallet} label="Ventas del mes" value="$1.200" />);
    expect(screen.getByText("$1.200")).toBeTruthy();
    expect(screen.getByText("Ventas del mes")).toBeTruthy();
  });
  it("muestra empty state cuando no hay valor", () => {
    render(<KpiCard icon={Wallet} label="Ventas del mes" />);
    expect(screen.getByText("—")).toBeTruthy();
    expect(screen.getByText("Sin datos aún")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Ejecutar — debe fallar**

Run: `npm test -- src/components/dashboard/kpi-card.test.tsx`
Expected: FAIL "Cannot find module './kpi-card'".

- [ ] **Step 3: Implementar `kpi-card.tsx`**

```tsx
import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown } from "lucide-react";

export function KpiCard({ icon: Icon, label, value, trend, sub }: {
  icon: LucideIcon; label: string; value?: string; trend?: { dir: "up" | "down"; text: string }; sub?: string;
}) {
  const empty = value === undefined || value === null;
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-center gap-2">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#0e7490]/10 text-[#0e7490] dark:text-[#5eead4]">
          <Icon className="h-4 w-4" strokeWidth={2} />
        </div>
        <p className="text-xs font-medium text-[var(--text-soft)]">{label}</p>
      </div>
      <p className="mt-3 text-[22px] font-extrabold tracking-[-0.4px] text-[var(--text)]">{empty ? "—" : value}</p>
      {empty ? (
        <p className="text-xs text-[var(--text-soft)]">Sin datos aún</p>
      ) : (
        <div className="flex items-center gap-2 text-xs">
          {trend && (
            <span className={`inline-flex items-center gap-0.5 font-semibold ${trend.dir === "up" ? "text-[#0f766e] dark:text-[#6ee7b7]" : "text-[#dc2626] dark:text-[#f87171]"}`}>
              {trend.dir === "up" ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />} {trend.text}
            </span>
          )}
          {sub && <span className="text-[var(--text-soft)]">{sub}</span>}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Ejecutar — debe pasar**

Run: `npm test -- src/components/dashboard/kpi-card.test.tsx`
Expected: PASS.

- [ ] **Step 5: Implementar `chart-card.tsx`, `attention-list.tsx`, `period-selector.tsx`**

`src/components/dashboard/chart-card.tsx`:
```tsx
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";

export function ChartCard({ title, icon, empty, emptyHint, children }: {
  title: string; icon: LucideIcon; empty?: boolean; emptyHint?: string; children?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <p className="mb-2 text-sm font-bold text-[var(--text)]">{title}</p>
      {empty ? <EmptyState icon={icon} title="Aún sin datos" hint={emptyHint} /> : children}
    </div>
  );
}
```

`src/components/dashboard/attention-list.tsx`:
```tsx
import { CircleCheck, TriangleAlert } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";

export type AttentionItem = { title: string; detail: string; tone: "warn" | "danger" | "info" };

export function AttentionList({ items }: { items: AttentionItem[] }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <p className="mb-2 text-sm font-bold text-[var(--text)]">Requieren atención</p>
      {items.length === 0 ? (
        <EmptyState icon={CircleCheck} title="Todo en orden" hint="No hay nada pendiente por ahora." />
      ) : (
        <ul className="space-y-2">
          {items.map((it, i) => (
            <li key={i} className="flex items-start gap-2 rounded-lg border border-[var(--border)] p-2.5">
              <TriangleAlert className="mt-0.5 h-4 w-4 text-[#b45309] dark:text-[#fbbf24]" strokeWidth={2} />
              <div>
                <p className="text-sm font-semibold text-[var(--text)]">{it.title}</p>
                <p className="text-xs text-[var(--text-soft)]">{it.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

`src/components/dashboard/period-selector.tsx`:
```tsx
"use client";
import { useState } from "react";

const PERIODS = ["Hoy", "Semana", "Mes", "Año"] as const;

export function PeriodSelector() {
  const [active, setActive] = useState<(typeof PERIODS)[number]>("Mes");
  return (
    <div className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--surface)] p-0.5">
      {PERIODS.map((p) => (
        <button key={p} onClick={() => setActive(p)}
          className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
            active === p ? "bg-[#0e7490] text-white" : "text-[var(--text-soft)] hover:text-[var(--text)]"}`}>
          {p}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add src/components/dashboard
git commit -m "feat: componentes de dashboard (KpiCard con test, ChartCard, AttentionList, PeriodSelector)"
```

---

## Task 17: Página del Dashboard (escritorio + móvil)

**Files:**
- Modify: `src/app/(app)/dashboard/page.tsx`

- [ ] **Step 1: Reescribir el dashboard usando los componentes (empty states)**

`src/app/(app)/dashboard/page.tsx`:
```tsx
import { createClient } from "@/lib/supabase/server";
import { DollarSign, TrendingUp, Users, Boxes, ArrowDownCircle, ArrowUpCircle, Receipt, AlertTriangle, BarChart3, PieChart } from "lucide-react";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { ChartCard } from "@/components/dashboard/chart-card";
import { AttentionList } from "@/components/dashboard/attention-list";
import { PeriodSelector } from "@/components/dashboard/period-selector";

export default async function Dashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user!.id).single();
  const firstName = ((profile?.full_name ?? "") as string).split(" ")[0] || "";

  return (
    <div className="space-y-5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-extrabold tracking-[-0.4px] text-[var(--text)]">
          Hola{firstName ? `, ${firstName}` : ""} 👋
        </h1>
        <PeriodSelector />
      </div>

      {/* Móvil: hero Utilidad + 4 KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:hidden">
        <div className="col-span-2"><KpiCard icon={TrendingUp} label="Utilidad del mes" /></div>
        <KpiCard icon={DollarSign} label="Ventas del mes" />
        <KpiCard icon={Users} label="Total de clientes" />
        <KpiCard icon={ArrowDownCircle} label="Por cobrar" />
        <KpiCard icon={AlertTriangle} label="Bajo stock" />
      </div>

      {/* Escritorio: 4 KPIs primarios + 4 secundarios */}
      <div className="hidden grid-cols-4 gap-3 lg:grid">
        <KpiCard icon={DollarSign} label="Ventas del mes" />
        <KpiCard icon={TrendingUp} label="Utilidad del mes" />
        <KpiCard icon={Users} label="Total de clientes" />
        <KpiCard icon={Boxes} label="Valor de inventario" />
        <KpiCard icon={ArrowDownCircle} label="Por cobrar" />
        <KpiCard icon={ArrowUpCircle} label="Por pagar" />
        <KpiCard icon={Receipt} label="Ticket promedio" />
        <KpiCard icon={AlertTriangle} label="Bajo stock / agotados" />
      </div>

      {/* Escritorio: gráficos */}
      <div className="hidden gap-4 lg:grid lg:grid-cols-3">
        <div className="lg:col-span-2"><ChartCard title="Ventas de la semana" icon={BarChart3} empty emptyHint="Aún no hay ventas registradas." /></div>
        <ChartCard title="Estado del inventario" icon={PieChart} empty emptyHint="Aún no hay productos en inventario." />
      </div>

      <AttentionList items={[]} />
    </div>
  );
}
```

- [ ] **Step 2: Verificar build**

Run: `npm run build`
Expected: build OK.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/dashboard/page.tsx"
git commit -m "feat: dashboard real con empty states (escritorio + móvil resumido)"
```

---

## Task 18: Auth — layout de marca + re-vestir login/registro

**Files:**
- Create: `src/app/(auth)/layout.tsx`
- Modify: `src/app/(auth)/login/page.tsx`, `src/app/(auth)/registro/page.tsx`

- [ ] **Step 1: `(auth)/layout.tsx` de marca**

`src/app/(auth)/layout.tsx`:
```tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-gradient-to-br from-[#0e7490] to-[#14b8a6] p-10 text-white lg:flex">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-white/15 text-sm font-black">K</div>
          <span className="text-lg font-extrabold tracking-[-0.4px]">Kontify</span>
        </div>
        <div>
          <h2 className="max-w-sm text-2xl font-extrabold tracking-[-0.4px]">Gestión administrativa, clara y a tu ritmo.</h2>
          <p className="mt-2 max-w-sm text-sm text-white/80">Inventario, ventas, finanzas y clientes en un solo lugar.</p>
        </div>
        <p className="text-xs text-white/60">© Kontify</p>
      </div>
      <div className="flex items-center justify-center bg-[var(--bg)] p-6">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Re-vestir `login/page.tsx`** (misma lógica del Plan 1, solo estilo)

`src/app/(auth)/login/page.tsx`:
```tsx
"use client";
import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setMsg("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { setMsg(error.message); return; }
    window.location.href = "/dashboard";
  }

  const input = "w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[#0e7490]";
  return (
    <form onSubmit={submit} className="space-y-3">
      <h1 className="text-xl font-extrabold tracking-[-0.4px] text-[var(--text)]">Entrar a Kontify</h1>
      <p className="text-sm text-[var(--text-soft)]">Bienvenido de vuelta.</p>
      <input className={input} placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input className={input} placeholder="Contraseña" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <button disabled={loading} className="w-full rounded-[10px] bg-gradient-to-br from-[#0e7490] to-[#14b8a6] py-2.5 text-sm font-semibold text-white disabled:opacity-60">
        {loading ? "Entrando…" : "Entrar"}
      </button>
      {msg && <p className="text-sm text-[#dc2626]">{msg}</p>}
      <p className="text-sm text-[var(--text-soft)]">¿No tienes cuenta? <Link href="/registro" className="font-semibold text-[#0e7490] dark:text-[#5eead4]">Crear una</Link></p>
    </form>
  );
}
```

- [ ] **Step 3: Re-vestir `registro/page.tsx`** (misma lógica del Plan 1, solo estilo)

`src/app/(auth)/registro/page.tsx`:
```tsx
"use client";
import { useState } from "react";
import Link from "next/link";

export default function Registro() {
  const [form, setForm] = useState({ email: "", password: "", fullName: "", companyName: "", slug: "" });
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setMsg("Creando…");
    const r = await fetch("/api/registro", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
    });
    const data = await r.json();
    setLoading(false);
    setMsg(r.ok ? `Listo. Tu espacio: ${data.slug}.kontify.app` : `Error: ${data.error}`);
    if (r.ok) window.location.href = "/dashboard";
  }
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });
  const input = "w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[#0e7490]";

  return (
    <form onSubmit={submit} className="space-y-3">
      <h1 className="text-xl font-extrabold tracking-[-0.4px] text-[var(--text)]">Crear cuenta Kontify</h1>
      <p className="text-sm text-[var(--text-soft)]">Crea tu empresa en un minuto.</p>
      <input className={input} placeholder="Empresa" value={form.companyName} onChange={set("companyName")} />
      <input className={input} placeholder="subdominio (ej. acme)" value={form.slug} onChange={set("slug")} />
      <input className={input} placeholder="Tu nombre" value={form.fullName} onChange={set("fullName")} />
      <input className={input} placeholder="Email" type="email" value={form.email} onChange={set("email")} />
      <input className={input} placeholder="Contraseña" type="password" value={form.password} onChange={set("password")} />
      <button disabled={loading} className="w-full rounded-[10px] bg-gradient-to-br from-[#0e7490] to-[#14b8a6] py-2.5 text-sm font-semibold text-white disabled:opacity-60">
        {loading ? "Creando…" : "Crear"}
      </button>
      {msg && <p className="text-sm text-[var(--text-soft)]">{msg}</p>}
      <p className="text-sm text-[var(--text-soft)]">¿Ya tienes cuenta? <Link href="/login" className="font-semibold text-[#0e7490] dark:text-[#5eead4]">Entrar</Link></p>
    </form>
  );
}
```

- [ ] **Step 4: Verificar build**

Run: `npm run build`
Expected: build OK.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(auth)"
git commit -m "feat: auth re-estilizado (layout de marca + login/registro a tokens; lógica intacta)"
```

---

## Task 19: Verificación final del Plan 2

- [ ] **Step 1: Toda la suite de tests pasa**

Run: `npm test`
Expected: PASS en nav, theme, empty-state, kpi-card, roles, bootstrap, rls.

- [ ] **Step 2: Build limpio**

Run: `npm run build`
Expected: sin errores ni de tipos.

- [ ] **Step 3: Verificación manual E2E** (con `npm run dev`, en `http://lvh.me:3000`)

Verificar:
- Login estilizado (panel gradiente izquierdo) → entrar con un usuario existente → cae en `/dashboard` dentro del shell dual-tier.
- El riel nivel-1 muestra las secciones; el panel nivel-2 muestra los hijos de la sección activa; navegar por Clientes/Operaciones/Reportes/Finanzas/Configuración **sin ningún 404**.
- Toggle "panel-left": colapsa/expande el panel; **recargar** la página mantiene el estado colapsado.
- Selector de sucursal (top bar) lista la sucursal real "Principal" + "Todas".
- Menú del avatar → cambiar tema: la app pasa a oscuro; **recargar** no parpadea (sin FOUC); persiste.
- Reducir el viewport a <1024px: aparece la barra inferior con el "+" squircle; "Más" abre la hoja con el perfil arriba; el tema se cambia desde Configuración → Preferencias.
- Con un usuario de rol no-owner (crear una membership de prueba o cambiar el rol en la BD): el menú muestra menos secciones (p. ej. `almacen` solo Inicio y Operaciones), y Configuración solo muestra Preferencias.

- [ ] **Step 4: Commit de cierre (si hubo ajustes)**

```bash
git add -A
git commit -m "chore: Plan 2 diseño visual completo (shell + dashboard + auth)" || echo "sin cambios"
```

---

## Notas para el Plan 3+ (no implementar aquí)

- CRUD real de Sucursales y Usuarios/roles (Configuración deja de ser placeholder).
- Buscador global funcional, notificaciones reales, charts con datos (añadir librería), acción real del FAB "Vender".
- Persistencia de tema por-usuario en BD; diseño final del logo.
- Cada módulo operativo (Productos, Facturación, Presupuestos, Reportes, Finanzas, Clientes) con su propio spec→plan→impl, rellenando su página placeholder y alimentando los KPIs del dashboard con datos reales.
