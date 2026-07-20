# Kontify Fundación — Plan 2: Diseño visual (shell dual-tier + dashboard)

> Spec de diseño. Fuente de verdad visual: `docs/design/design-system.md` y `docs/design/mockups/*`.
> Este documento captura las decisiones de alcance/arquitectura acordadas en el brainstorming (2026-07-19)
> para implementar el sistema de diseño sobre el motor multi-tenant del Plan 1 (mergeado a `master`).

## Objetivo

Construir el shell visual de Kontify —navegación dual-tier en escritorio y layout móvil, top bar, FAB
"Vender", tema claro/oscuro— y el Dashboard, todo fiel al `design-system.md` y cableado a los datos reales
que ya existen del Plan 1 (usuario, tenant, rol, sucursales, logout). Reemplaza el `/dashboard` placeholder.

## Contexto y punto de partida

- **Plan 1 (implementado, en `master`):** Next 16.2.10 + React 19 + Tailwind 4 + Supabase local. Tablas
  `tenants/branches/profiles/memberships` con RLS. Helpers `canAccess(role, resource)` / `isBranchScoped`
  en `src/lib/auth/roles.ts`. Clientes Supabase browser/server/admin. `src/proxy.ts` (Next 16 renombró
  middleware→proxy) refresca sesión y resuelve subdominio→`x-tenant-slug`. Tokens Teal & Slate en
  `globals.css` (Tailwind 4 CSS-first: `@theme` + `@custom-variant dark`).
- **No existe todavía:** ningún módulo operativo (productos, ventas, facturas, clientes como datos). Por eso
  el Dashboard **no puede** mostrar números reales aún.

## Decisiones de alcance (acordadas)

1. **Dashboard con estados vacíos reales**, no datos falsos. Los componentes del dashboard son
   presentacionales (reciben datos por props); en Plan 2 reciben data vacía → muestran su *empty state*.
   Cuando lleguen los módulos, fluyen datos reales sin re-diseñar. Sin deuda de mock.
2. **Todas las rutas del menú como placeholder navegable.** Se crean las ~20 rutas de la IA como páginas
   mínimas (encabezado + empty state "este módulo llega pronto"). El shell queda 100% navegable, nada da
   404. Cada plan de módulo futuro rellena su página. (Incluye Configuración: su CRUD real es un plan aparte;
   **excepción:** Preferencias aloja el toggle de tema funcional, ver §Tema.)
3. **Interactividad con Radix UI primitives (headless) + Tailwind.** Dropdowns, tooltips, sheet, popover
   accesibles de fábrica, vestidos con nuestras clases. Compatibles con React 19 / Next 16.
4. **Navegación dirigida por URL + config central (`nav.ts`).** La sección activa se deriva del pathname;
   no se guarda en estado. `nav.ts` es la fuente de verdad de la IA, gateada por rol.

## Arquitectura de archivos

```
src/
├── lib/
│   ├── nav.ts                    # IA completa: secciones→hijos, icono, ruta, resource(rol). FUENTE DE VERDAD del menú
│   ├── nav.test.ts               # estructura, navForRole, resolveActiveSection
│   ├── theme.ts                  # lee/escribe localStorage("kontify-theme"), aplica clase .dark en <html>
│   └── theme.test.ts
├── components/
│   ├── ui/                       # wrappers Radix vestidos con Tailwind (reutilizables)
│   │   ├── dropdown-menu.tsx     #   avatar, selector sucursal, selector periodo
│   │   ├── tooltip.tsx           #   tooltips de iconos nivel-1
│   │   ├── sheet.tsx             #   hoja "Más" (móvil), panel notificaciones
│   │   └── theme-toggle.tsx      #   sol/luna
│   ├── shell/
│   │   ├── app-shell.tsx         # layout cliente: orquesta desktop vs móvil (breakpoint lg), estado colapso panel
│   │   ├── rail.tsx              # nivel-1: riel 72px #0f172a, tiles + tooltips
│   │   ├── subnav.tsx            # nivel-2: panel 236px, hijos de la sección activa
│   │   ├── topbar.tsx            # toggle panel-left · buscador · sucursal · campana · avatar
│   │   ├── fab-vender.tsx        # FAB squircle "+" (escritorio abajo-derecha)
│   │   ├── mobile-bottom-nav.tsx # barra inferior + "+" squircle central elevado
│   │   └── mobile-more-sheet.tsx # hoja "Más" con perfil arriba
│   ├── dashboard/
│   │   ├── kpi-card.tsx          # presentacional: icono+label+valor+trend, empty state
│   │   ├── chart-card.tsx        # marco de gráfico con empty state (barras/donut vacíos)
│   │   ├── attention-list.tsx    # "Requieren atención" con empty state
│   │   └── period-selector.tsx   # Hoy/Semana/Mes/Año (visual)
│   └── shared/
│       ├── module-placeholder.tsx # encabezado + empty state para rutas "pronto"
│       └── empty-state.tsx        # ícono+título+texto, base de todos los vacíos
└── app/
    ├── layout.tsx                # lang="es" + script inline anti-FOUC de tema
    ├── (app)/                    # grupo protegido con el AppShell
    │   ├── layout.tsx            # SERVER: valida sesión+membership; inyecta user/tenant/rol/branches al shell
    │   ├── dashboard/page.tsx    # dashboard real (empty states)
    │   ├── notificaciones/page.tsx, actividad/page.tsx
    │   ├── clientes/page.tsx
    │   ├── operaciones/{productos,facturacion,presupuestos}/page.tsx
    │   ├── reportes/{inventario,ventas}/page.tsx
    │   ├── finanzas/{cuentas-por-pagar,cuentas-por-cobrar,comisiones,bancos,gastos}/page.tsx
    │   └── configuracion/{sucursales,usuarios,preferencias}/page.tsx
    └── (auth)/                   # login/registro re-estilizados
        ├── layout.tsx           # auth-layout de marca (panel gradiente + wordmark)
        ├── login/page.tsx       # (re-vestido; lógica del Plan 1 intacta)
        └── registro/page.tsx
```

**Principio de aislamiento:** `components/dashboard/*` y `components/ui/*` son presentacionales puros (props,
sin fetching) → testeables/reusables. `(app)/layout.tsx` (server) es el ÚNICO que toca Supabase para el shell
e inyecta los datos reales al `app-shell` cliente.

## Componentes / unidades

### `lib/nav.ts` (fuente de verdad de la IA)
Estructura tipada que refleja 1:1 la IA del design-system §5:

- **Inicio** → Dashboard, Notificaciones, Actividad
- **Clientes** → Todos los clientes, Nuevo cliente
- **Operaciones** → Productos, Facturación, Presupuestos
- **Reportes** → Inventario, Ventas
- **Finanzas** → Cuentas por pagar, Cuentas por cobrar, Comisiones, Bancos, Gastos
- **Configuración** (abajo del riel) → Sucursales, Usuarios y roles, Preferencias

Cada sección tiene `resource` (de `roles.ts`) para el gateo. Dos helpers puros:
- `navForRole(role)` → filtra secciones/hijos con `canAccess(role, section.resource)`. Owner/Admin ven todo.
- `resolveActiveSection(pathname)` → sección nivel-1 activa derivada de la URL.

**Seguridad:** el filtrado por rol en `nav.ts` es solo UX (ocultar). La autorización real vive en RLS/endpoints;
el menú nunca es la barrera de seguridad.

### Shell de escritorio (dual-tier, design-system §5)
- **Riel nivel-1** (`rail.tsx`, 72px, `#0f172a` en ambos modos): un tile por sección de `navForRole`. Tile
  activo = gradiente teal `linear-gradient(135deg,#0e7490,#14b8a6)` con glow; inactivos slate translúcido.
  Tooltip Radix al hover. Abajo: Configuración + avatar. Click → navega al primer hijo de la sección.
- **Panel nivel-2** (`subnav.tsx`, 236px, superficie clara): título de sección + hijos. Ítem activo: fondo teal
  tenue `#e6f7f4` (equivalente oscuro), texto teal, barra de acento izquierda 3px. Colapsable 236px↔0 con
  transición de ancho 0.28s; estado en localStorage.
- **Top bar** (`topbar.tsx`): toggle **"panel-left"** arriba-izquierda (NO hamburguesa, NO en la costura) ·
  buscador global (input visual, sin backend) · **selector de sucursal** (Dropdown Radix con las sucursales
  reales del tenant + "Todas"=consolidado, según rol §9) · campana con badge (abre Sheet notificaciones con
  empty state) · avatar (Dropdown: nombre+rol, tema, Configuración, Cerrar sesión→logout real).
- **FAB "Vender"** (`fab-vender.tsx`): flotante abajo-derecha, squircle ~40%, gradiente teal, solo "+".
  Handler placeholder marcado: navega a `/operaciones/facturacion` (venta rápida real llega con ese módulo).

### Shell móvil (mobile-first, design-system §6) — activo por debajo de `lg` (1024px)
- **Barra inferior** (`mobile-bottom-nav.tsx`): Inicio · Vender · **[ + ]** · Inventario · Más. El "+" central
  es **squircle** (border-radius ~22 sobre 46px, gradiente teal, solo símbolo), elevado −18/22px.
- **Top bar móvil**: solo selector de sucursal + campana. **Sin avatar en el top bar.**
- **Hoja "Más"** (`mobile-more-sheet.tsx`, Sheet Radix): arriba el perfil (avatar, nombre, rol, "Ver perfil");
  luego *Cuenta* (Cambiar sucursal, Configuración) / *Módulos* (Presupuestos, Reportes, Finanzas) / *Otros*
  (Ayuda, Cerrar sesión). Scroll sin scrollbar visible (`scrollbar-width:none` + `::-webkit-scrollbar{display:none}`).

### Tema (claro/oscuro, ambos obligatorios §2)
- `lib/theme.ts`: lee/escribe `localStorage("kontify-theme")`, aplica/quita `.dark` en `<html>`; default =
  preferencia del sistema.
- **Anti-FOUC:** script inline mínimo en `app/layout.tsx` que aplica la clase antes de pintar.
- **Ubicación del toggle:** escritorio → menú del avatar; **móvil → Configuración → Preferencias** (NO en "Más").
  Por eso la página Preferencias no es placeholder puro: aloja el `theme-toggle` funcional (resto de la página
  queda "pronto"). El toggle también está disponible en Preferencias en escritorio.

### Dashboard (§7) — presentacional con empty states
- `kpi-card.tsx`: icono en tile tenue + label + valor grande + trend chip (▲/▼ semántico). Empty: valor "—",
  subtítulo "Sin datos aún". Usado en 4 KPIs primarios + 4 secundarios.
- `chart-card.tsx`: marco con título; "Ventas de la semana" (barras) y "Estado del inventario" (donut) con
  **empty state dibujado** (ejes/donut tenues + texto). **Librería de charts diferida** (YAGNI: nada que graficar).
- `attention-list.tsx`: "Requieren atención" con empty ("Todo en orden ✓").
- `period-selector.tsx`: Hoy/Semana/Mes/Año, visual.
- Cablea lo real: saludo con nombre real del usuario; selector de sucursal del top bar afecta contexto.
- **Móvil resumido:** Saludo → Hero Utilidad del mes → 4 KPIs (Ventas mes · Total clientes · Por cobrar · Bajo
  stock) → Requieren atención (2). Donut/top-productos/clientes-por-tipo NO van en el inicio móvil.

### Auth re-estilizado
`(auth)/layout.tsx` de marca: panel dividido con lado gradiente teal + wordmark "Kontify"/isotipo tile "K";
formulario en superficie con inputs/botones a tokens (radios 9–11px, botón gradiente). Mismos campos y misma
lógica del Plan 1 (signup/bootstrap y login **intactos**), solo el vestido. Estados visibles: error en línea,
botón "cargando". Respetan claro/oscuro.

## Dependencias nuevas
- `lucide-react` (iconos §3)
- `@radix-ui/react-dropdown-menu`, `@radix-ui/react-tooltip`, `@radix-ui/react-dialog` (Sheet),
  `@radix-ui/react-popover`
- (Charts: ninguno todavía — diferido)

## Estrategia de testing
- **Unit (Vitest, ya configurado):**
  - `nav.test.ts`: estructura de la IA; `navForRole` (owner ve todo; vendedor/cajero/almacén filtrados);
    `resolveActiveSection(pathname)`.
  - `theme.test.ts`: lee/escribe localStorage + aplica clase.
- **Componentes presentacionales:** tests ligeros (React Testing Library + jsdom, environment jsdom solo para
  estos) de que `kpi-card`/`empty-state` renderizan su empty state con props vacías.
- **Verificación manual E2E (documentada en el plan):** login estilizado → shell dual-tier navega por todas las
  secciones sin 404 → colapso del panel persiste al refrescar → selector de sucursal lista las sucursales reales
  → tema conmuta y persiste sin FOUC → móvil (<lg) muestra barra inferior + "Más" con perfil → role-gating (un
  no-owner ve menos ítems).
- **Regresión:** suite del Plan 1 (9 tests) sigue verde; `npm run build` limpio.

## Fuera de alcance (explícito, cada uno es plan posterior)
CRUD real de sucursales/usuarios; búsqueda global funcional; notificaciones reales; charts con datos; acción de
venta rápida del FAB; persistencia de tema por-usuario en BD; diseño final de logo.

## Criterios de éxito
- Shell dual-tier (escritorio) y layout móvil 100% navegables, fieles al design-system y mockups aprobados.
- Tema claro/oscuro conmuta y persiste sin FOUC.
- Dashboard renderiza su layout completo con empty states honestos.
- Auth (login/registro) re-estilizado a marca, con la lógica del Plan 1 intacta.
- Menú gateado por rol vía `nav.ts`; datos reales del Plan 1 cableados (user/tenant/rol/sucursales/logout).
- Tests unit verdes + suite Plan 1 intacta + build limpio.
