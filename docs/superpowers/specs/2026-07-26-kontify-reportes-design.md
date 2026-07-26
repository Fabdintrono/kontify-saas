# Kontify — Reportes / Ventas y Utilidad (Plan 9): Diseño

> Spec de diseño. Séptimo módulo, sobre Fundación (Plan 1), shell (Plan 2), Clientes (Plan 3), Productos (Plan 4), Facturación (Plan 5), Cobros (Plan 6), Inventario (Plan 7) y Presupuestos (Plan 8), todos en `master`.
> Fuente de verdad visual: `docs/design/design-system.md`. Decisiones acordadas en brainstorming 2026-07-26.

## Objetivo

Reporte de Ventas por período (presets + rango personalizado): resumen (Nº ventas, ingresos, utilidad, ticket promedio) y desgloses por día, top productos, por vendedor y por cliente; y llenar los huecos del dashboard (Utilidad del mes, Ventas de la semana, Top productos). Habilita la **utilidad/margen** guardando el costo al vender. Reemplaza el placeholder de `/reportes/ventas`.

## Contexto y punto de partida

- **Plan 5 (`master`):** `sales` (con `total`, `tax_total`, `status`, `issued_at`, `created_by`, `client_id`, `branch_id`), `sale_items` (con `product_id`, `description`, `quantity`, `unit_price`, `discount_pct`, `tax_rate`). `computeSaleTotals`. `replaceItems` en `src/lib/ventas/mutations.ts` (delete+insert de líneas en `createDraft`/`updateDraft`). **`sale_items` NO guarda costo.**
- **Plan 4:** `products.cost` (nullable, sensible — oculto en UI a vendedor/cajero, pero legible por RLS). `canManageProducts` (owner/admin/administrativo/almacen). `getTenantCurrency`, `formatMoney`.
- **Plan 1:** `canAccess(role, "reportes")` = owner/admin/administrativo. `profiles(id, full_name)` con `id` = `auth.users.id`. Tests de integración serial.
- **Dashboard:** KPIs placeholder "Utilidad del mes"; `ChartCard` "Ventas de la semana" vacío. `PeriodSelector` visual existente. (KPIs de Ventas del mes/Ticket promedio/Por cobrar ya reales desde Planes 5/6.)
- **Nav:** "Ventas" bajo Reportes (`/reportes/ventas`, recurso `reportes`) es placeholder. ("Inventario" de Reportes ya es la valorización del Plan 7.)
- **No existe todavía:** costo en las líneas de venta ni ninguna query de reportes de ventas.

## Decisiones de alcance (acordadas)

1. **Utilidad con costo snapshot al vender.** Nueva columna `sale_items.unit_cost`, poblada en el servidor desde `products.cost` al guardar la venta. Utilidad histórica estable.
2. **Reporte de Ventas** con resumen + **cuatro desgloses**: por día, top productos, por vendedor, por cliente.
3. **Período:** presets (Hoy / Esta semana / Este mes / Mes pasado) + rango personalizado `from`/`to`; viaja en la URL.
4. **Gating:** el reporte es back-office (`reportes`); el KPI "Utilidad del mes" del dashboard se gatea a `canManageProducts` (ve costo).
5. **Gráficos:** barras simples sin librería (estilo de los widgets existentes).
6. **Agregación en JS** sobre las lecturas RLS-scoped (patrón de los módulos previos); escalar a SQL queda fuera de alcance.

## Modelo de datos

**Cambio único:**
```
alter table public.sale_items add column unit_cost numeric(14,2);
```
Nullable. **Poblado server-side** en `replaceItems` (`src/lib/ventas/mutations.ts`): para cada línea con `product_id`, se busca `products.cost` y se guarda como `unit_cost`. **El costo nunca viaja desde el cliente** (el builder no lo envía; el vendedor no lo ve). Líneas de texto libre (sin `product_id`) o ventas previas al cambio quedan con `unit_cost = null`. La conversión de presupuesto usa el mismo `createDraft`, así que hereda el snapshot.

Sin cambios de RLS: `sale_items` ya está cubierto por sus políticas; `products.cost` ya es legible por RLS, así que `unit_cost` no agrega exposición nueva.

Migración nueva: `0026_sale_item_cost.sql`.

## Definición de utilidad

Por venta **emitida** (`status='issued'`, no anulada):
```
ingreso_neto = total − tax_total                 -- columnas guardadas en sales (neto sin impuesto, tras descuentos)
costo_total  = Σ (unit_cost × quantity)          -- de sale_items (líneas con unit_cost no nulo)
utilidad     = ingreso_neto − costo_total
margen %     = ingreso_neto > 0 ? utilidad / ingreso_neto × 100 : 0
```
- **Costo incompleto:** si alguna línea de la venta tiene `unit_cost = null`, su costo subestima y la venta se cuenta en `costIncompleteCount`. Los agregados suman los costos disponibles y exponen ese conteo (honestidad). Las ventas nuevas (post-cambio) tienen costo completo.
- **Sensibilidad:** la utilidad revela margen. El reporte es back-office; el KPI del dashboard se gatea a `canManageProducts`. Ingresos y "ventas por día" no son sensibles.

## Cambio en Facturación (incluido en este plan)

`replaceItems` (`src/lib/ventas/mutations.ts`): antes de insertar las líneas, resuelve los costos. Reúne los `product_id` no nulos de las líneas, consulta `products(id, cost)`, arma un mapa, y al insertar cada línea añade `unit_cost = costMap[product_id] ?? null`. Es la única modificación a Ventas; cubre ventas directas y las creadas al convertir un presupuesto. Con sus tests de regresión.

## Capa de servidor (`src/lib/reportes/queries.ts`)

Tipos:
```
type DateRange = { from: string; to: string };   // ISO 'YYYY-MM-DD' inclusivos
type SalesReport = {
  summary: { count: number; revenue: number; utility: number; avgTicket: number; marginPct: number; costIncompleteCount: number };
  byDay: { date: string; revenue: number; utility: number }[];
  byProduct: { productId: string | null; name: string; qty: number; revenue: number }[];
  bySeller: { userId: string | null; name: string; count: number; revenue: number; utility: number }[];
  byClient: { clientId: string | null; name: string; count: number; revenue: number }[];
};
```

- **`salesReport(sb, { from, to, branchId })`** (RLS-scoped, degradación segura → estructura vacía):
  1. Trae ventas emitidas del rango: `select id, created_by, client_id, total, tax_total, issued_at, clients(name) from sales where status='issued' and issued_at >= from and issued_at < (to + 1 día)` (+ `branch_id` si `branchId`).
  2. Trae sus líneas: `select sale_id, product_id, description, quantity, unit_price, discount_pct, unit_cost from sale_items where sale_id in (...)`.
  3. Trae nombres de vendedor: `select id, full_name from profiles where id in (created_by...)`.
  4. Agrega en JS:
     - costo por venta = Σ(`unit_cost×quantity`) de sus líneas; `costComplete` = ninguna línea con `unit_cost null`.
     - `ingreso_neto` por venta = `total − tax_total`; `utilidad` = `ingreso_neto − costo`.
     - `summary`: count, `revenue`=Σtotal, `utility`=Σutilidad, `avgTicket`=revenue/count, `marginPct` global, `costIncompleteCount`.
     - `byDay`: agrupa por `date(issued_at)` → revenue, utility.
     - `byProduct`: agrupa líneas por `product_id` (label = `description`) → qty=Σquantity, revenue=Σ(`quantity×unit_price×(1−discount_pct/100)`); ordenado por revenue desc.
     - `bySeller`: agrupa ventas por `created_by` (label = `profiles.full_name` o "—") → count, revenue, utility.
     - `byClient`: agrupa por `client_id` (label = `clients.name` o "Consumidor final") → count, revenue; ordenado por revenue desc.
- **Wrappers dashboard** (reusan `salesReport`, degradación segura):
  - `utilityThisMonth(sb)` → `{ utility, costIncompleteCount }` (rango = mes en curso).
  - `salesByDayThisWeek(sb)` → `byDay` (rango = semana en curso, lunes a hoy).
  - `topProductsThisMonth(sb, limit=5)` → `byProduct` del mes recortado a `limit`.

Helper de rango: `monthRange()`, `weekRange()` (lunes→hoy), `presetRange(preset)` en un módulo compartido `src/lib/reportes/ranges.ts` (puro, testeable): `hoy`, `semana`, `mes`, `mes_pasado`.

## UI

Lenguaje visual Plan 2. Reusa `formatMoney`, `getTenantCurrency`, `EmptyState`, `KpiCard`.

- **`/reportes/ventas` (reporte)** — server component; gateado por `canAccess(role, "reportes")` (redirige a `/dashboard` si no). Lee `from`/`to`/`branch` de `searchParams` (default: mes en curso). Llama `salesReport`.
  - **`period-selector.tsx`** (client): botones Hoy / Esta semana / Este mes / Mes pasado (setean `from`/`to` en la URL con `presetRange`) + inputs `desde`/`hasta` (date) + filtro de sucursal (solo back-office). Muestra el rango activo.
  - **Tarjetas de resumen:** Ventas (count) · Ingresos (`formatMoney`) · **Utilidad** (+`marginPct`%) · Ticket promedio. Nota "N ventas sin costo registrado" si `costIncompleteCount > 0`.
  - **Ventas por día:** `bar-chart` (barras simples).
  - **Top productos / Por vendedor / Por cliente:** tablas (`report-tables.tsx`).
  - Empty state si no hay ventas en el rango.
- **Dashboard** (`dashboard/page.tsx`, degradación segura):
  - **"Utilidad del mes"** (KPI móvil y escritorio) ← `utilityThisMonth.utility`, gateado a `canManageProducts(role)`; vendedor/cajero lo ven vacío.
  - **"Ventas de la semana"**: el `ChartCard` vacío se reemplaza por un `bar-chart` real ← `salesByDayThisWeek`.
  - Nuevo widget **"Top productos"** ← `topProductsThisMonth` (lista con barras, estilo "Productos por categoría"), en el grid de escritorio.
- **Componentes** `src/components/reportes/`: `period-selector.tsx` (client), `bar-chart.tsx` (barras simples reutilizables; lo usa también el dashboard para "Ventas de la semana"), `report-tables.tsx` (top productos/vendedor/cliente).
- **Nav:** sin cambios (el item "Ventas" ya existe en Reportes).

## Testing

- **Unit:** `ranges.test.ts` (`presetRange`/`monthRange`/`weekRange` devuelven rangos correctos para fechas fijas dadas por parámetro — sin usar `Date.now()` en el assert; se prueban las funciones puras con una fecha base inyectada).
- **Integración (Supabase local + RLS, serial, patrón Plan 1):**
  - `createDraft` puebla `unit_cost` de cada línea con `product_id` (= `products.cost`); una línea de texto libre queda `unit_cost=null`.
  - `salesReport` con ventas conocidas (precio, costo, impuesto): `revenue`, `utility = ingreso_neto − costo`, `avgTicket`, `count` correctos; una venta **anulada** no cuenta; una venta con línea sin costo incrementa `costIncompleteCount`.
  - `byDay` agrupa por fecha; `byProduct` rankea por ingreso; `bySeller` agrupa por `created_by` con nombre de `profiles`; `byClient` agrupa por cliente.
  - Rango: una venta fuera de `[from,to]` se excluye.
- **Regresión:** los tests de ventas/cobros/inventario/presupuestos siguen verdes tras el cambio de `replaceItems` (ahora escribe `unit_cost`) + `npm run build` limpio.
- **E2E manual:** con ventas emitidas, entrar a `/reportes/ventas`: resumen con utilidad y margen; cambiar presets y rango; filtro de sucursal; ventas por día; top productos / vendedor / cliente. Dashboard: "Utilidad del mes" (solo rol con costo), "Ventas de la semana" con barras, "Top productos". Role-gating: `/reportes/ventas` redirige a vendedor/cajero/almacén; el KPI de utilidad les sale vacío.

## Fuera de alcance (planes posteriores)

Export a Excel/CSV/PDF; costeo promedio móvil (se usa el snapshot); gráficos con librería (Recharts u otra); reportes de inventario avanzados (rotación, kardex, valorización histórica); comparativas período vs período; agregación en SQL/vistas/RPC para grandes volúmenes; reportes de compras/gastos (otros módulos de Finanzas); poblar `unit_cost` retroactivamente en ventas históricas.
