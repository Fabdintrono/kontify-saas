# Kontify — Inventario / Núcleo de Stock (Plan 7): Diseño

> Spec de diseño. Quinto módulo operativo, sobre Fundación (Plan 1), shell (Plan 2), Clientes (Plan 3), Productos (Plan 4), Facturación (Plan 5) y Cobros (Plan 6), todos en `master`.
> Fuente de verdad visual: `docs/design/design-system.md`. Espeja el patrón de los módulos previos. Decisiones acordadas en brainstorming 2026-07-26.

## Objetivo

Llevar existencias por producto × sucursal (solo productos `good`), registrar movimientos (ajustes de entrada/salida) con historial, descontar stock automáticamente al **emitir** ventas y reponerlo al **anular**, con stock mínimo por producto. Alimenta el dashboard (Valor de inventario, Bajo stock, Estado del inventario), el detalle de producto (existencias + movimientos) y un reporte de valorización. Reemplaza el placeholder de `/reportes/inventario` y el empty state "Existencias/Movimientos" del producto.

## Contexto y punto de partida

- **Plan 4 (`master`):** `products` con `kind` (`good`/`service`), `cost` (opcional, sensible — oculto a vendedor/cajero en UI), `active`. `canManageProducts` (owner/admin/administrativo/almacen) en `@/lib/productos/permissions`. `getTenantCurrency`, `formatMoney`.
- **Plan 5 (`master`):** `sales`/`sale_items` (item con `product_id` nullable, `quantity`), estados `draft/issued/void`, `emitSale`/`voidSale` en `src/lib/ventas/mutations.ts`, `branch_id` en la venta, helper `current_user_branch_id()`, scoping por sucursal en RLS.
- **Plan 6 (`master`):** patrón ledger+trigger ya usado para `paid_amount` (trigger SECURITY DEFINER que recomputa/actualiza una tabla desde otra); RLS laxo + barrera en la Server Action; `voidSale` ya bloquea con cobros activos.
- **Roles:** `almacen` (recurso `operaciones`) es el rol de stock; back-office (owner/admin/administrativo) tiene `operaciones`, `reportes`, `finanzas`; vendedor→operaciones/clientes; cajero→caja/operaciones. `isBranchScoped` = vendedor/cajero/almacen.
- **Nav:** item "Inventario" hoy bajo Reportes (`/reportes/inventario`, recurso `reportes`). El dashboard tiene KPIs placeholder "Valor de inventario", "Bajo stock", "Bajo stock / agotados" y un `ChartCard` "Estado del inventario" vacío.
- **No existe todavía:** ninguna tabla de stock ni `min_stock`.

## Decisiones de alcance (acordadas)

1. **Solo núcleo de stock.** Existencias por producto×sucursal, movimientos (ajustes + automáticos por venta), min_stock, dashboard, detalle de producto, reporte de valorización. Sin transferencias entre sucursales, compras/proveedores ni lotes.
2. **Stock por sucursal.** Los productos son a nivel empresa, pero la existencia es por sucursal. Operativos ven la de su sucursal; back-office todas.
3. **Sobreventa permitida (stock negativo).** Emitir una venta con stock insuficiente NO se bloquea; el nivel puede quedar negativo (visible como alerta). El almacén corrige con un ajuste.
4. **Stock mínimo por producto** (a nivel empresa): `products.min_stock`. "Bajo stock" = existencia en una sucursal ≤ min_stock.
5. **Gestión en Operaciones; ajustes por almacén + back-office.** Nueva pantalla "Inventario" bajo Operaciones (visible a almacén). Registran ajustes: almacén, owner, admin, administrativo. Vendedor/cajero solo ven existencias. El reporte de valorización vive en Reportes (back-office).
6. **Solo productos `good`** llevan stock; los `service` se ignoran.
7. **Arquitectura ledger + caché por trigger** (mismo patrón que `paid_amount` de Cobros): `stock_movements` append-only + `stock_levels` mantenido por trigger. La existencia es siempre `Σ qty_delta`.
8. **RLS laxo + barrera en la acción** (patrón Cobros): INSERT de movimientos permitido a los 6 roles (para que el descuento por venta lo cree el vendedor/cajero al emitir); la restricción de ajustes manuales vive en `registerAdjustmentAction` (`canManageStock`).

## Modelo de datos

Enum nuevo:
```
create type public.stock_movement_type as enum ('adjustment','sale','sale_void');
```

### `stock_movements` (ledger append-only)
```
id         uuid pk default gen_random_uuid()
tenant_id  uuid not null → tenants(id) on delete cascade      -- denormalizado para RLS
product_id uuid → products(id) on delete set null
branch_id  uuid not null → branches(id) on delete restrict
qty_delta  numeric(14,2) not null                             -- + entrada / − salida
type       public.stock_movement_type not null
sale_id    uuid → sales(id) on delete set null                -- ref cuando viene de una venta
reason     text
created_by uuid → auth.users(id) on delete set null
created_at timestamptz not null default now()
índices: (tenant_id, product_id), (branch_id), (sale_id)
```
Nunca se edita ni borra; revertir = movimiento compensatorio (ej. `sale_void`).

### `stock_levels` (caché por producto×sucursal)
```
tenant_id  uuid not null → tenants(id) on delete cascade
product_id uuid not null → products(id) on delete cascade
branch_id  uuid not null → branches(id) on delete cascade
qty        numeric(14,2) not null default 0
primary key (product_id, branch_id)
índice: (tenant_id)
```

### `products.min_stock`
```
alter table public.products add column min_stock numeric(14,2) not null default 0;
```

### Trigger — `apply_stock_movement()`
Mantiene `stock_levels` de forma atómica y race-safe:
```sql
create or replace function public.apply_stock_movement()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.stock_levels(tenant_id, product_id, branch_id, qty)
    values (new.tenant_id, new.product_id, new.branch_id, new.qty_delta)
    on conflict (product_id, branch_id) do update set qty = public.stock_levels.qty + new.qty_delta;
  return null;
end; $$;

create trigger trg_apply_stock_movement
  after insert on public.stock_movements
  for each row execute function public.apply_stock_movement();
```
El nivel puede quedar negativo (sobreventa permitida). SECURITY DEFINER → escribe `stock_levels` saltándose RLS.

### Estados derivados (no columnas)
Por producto×sucursal: *agotado* (`qty ≤ 0`), *bajo* (`0 < qty ≤ min_stock`), *en stock* (`qty > min_stock`). Valorización = `Σ qty × products.cost`.

### RLS y GRANTs
Rol vía `current_user_role()`; scoping por sucursal como en ventas.
- `stock_movements` **enable RLS**:
  - **SELECT:** `tenant_id = current_tenant_id() AND ( current_user_role() in ('owner','admin','administrativo') OR branch_id = current_user_branch_id() )`.
  - **INSERT (laxo):** `tenant_id = current_tenant_id() AND current_user_role() in ('owner','admin','administrativo','vendedor','cajero','almacen')` (los 6 roles, para el descuento por venta). Sin UPDATE/DELETE (append-only).
- `stock_levels` **enable RLS**:
  - **SELECT:** igual scoping por sucursal. Sin políticas de escritura (solo el trigger, SECURITY DEFINER).
- **Barrera de ajustes manuales:** `registerAdjustmentAction` exige `canManageStock` (almacén + back-office). La pantalla de Inventario en Operaciones es visible a esos roles; vendedor/cajero solo leen.
- `products.min_stock`: se edita vía la Server Action de Productos (rol back-office/almacén; `products_update` existente ya lo permite — sin cambios de RLS).
- GRANTs a `authenticated`: `select, insert` en `stock_movements`; `select` en `stock_levels`.

Migraciones nuevas (forward-only): `0020_stock_schema.sql` (enum + tablas + `products.min_stock` + índices), `0021_stock_rls.sql` (policies + grants), `0022_stock_trigger.sql` (función + trigger).

## Integración con Ventas (cambios en Facturación, incluidos en este plan)

Helpers en `src/lib/inventario/mutations.ts` (dependencia unidireccional ventas → inventario):
- `applySaleStockOut(sb, saleId)` — lee `sale_items` de la venta con `products(kind)`; por cada ítem con `product_id` y `kind='good'`, inserta un `stock_movement` (`type='sale'`, `qty_delta = −quantity`, `branch_id` de la venta, `sale_id`, `tenant_id`).
- `reverseSaleStock(sb, saleId)` — por cada ítem `good` de la venta, inserta un movimiento compensatorio (`type='sale_void'`, `qty_delta = +quantity`).

Cambios:
- **`emitSale`** (`src/lib/ventas/mutations.ts`): tras pasar a `issued` (y crear el cobro del contado del Plan 6), llama `applySaleStockOut(sb, id)`. Mantiene su firma (lee `branch_id`/`tenant_id` de la venta).
- **`voidSale`** (`src/lib/ventas/mutations.ts`): tras validar (bloqueo por cobros del Plan 6) y pasar a `void`, llama `reverseSaleStock(sb, id)`.
- Servicios y líneas sin `product_id` no generan movimientos. Los movimientos por venta se insertan con el rol del emisor (RLS INSERT laxo lo permite).

## Capa de servidor (`src/lib/inventario/*`)

- **`permissions.ts`** — `canManageStock(role)` → `role ∈ {owner,admin,administrativo,almacen}`.
- **`schema.ts`** — Zod: `adjustmentSchema` (`productId` uuid/guid, `branchId` uuid/guid, `direction` ∈ {`in`,`out`}, `quantity` `>0`, `reason` opcional). La acción computa `qty_delta = direction==='in' ? quantity : −quantity`.
- **`mutations.ts`** — `registerAdjustment(sb, tenantId, userId, input)` (inserta movimiento `adjustment` con el `qty_delta` firmado); `applySaleStockOut` / `reverseSaleStock` (sale-driven, arriba).
- **`queries.ts`** (RLS-scoped, degradación segura → vacíos/ceros):
  - `listStock(sb, {search, status, branchId})` → productos `good` con existencia (por `branchId` si se pasa, o consolidada), `min_stock` y estado; `status` ∈ `todos|bajo|agotado`. Filas `{ productId, name, sku, qty, minStock, status }`.
  - `getProductStock(sb, productId)` → `{ levels: [{ branchId, branchName, qty }], minStock }`.
  - `listMovements(sb, productId, {limit})` → historial `{ id, type, qtyDelta, branchName, reason, createdAt }`.
  - `stockKpi(sb)` → `{ value, lowCount, outCount }` (value = `Σ qty × cost`; low/out por producto×sucursal).
  - `inventoryStatusBreakdown(sb)` → `{ inStock, low, out }` (conteos para el donut).
  - `inventoryValuation(sb, {branchId})` → `{ total, rows: [{ productId, name, qty, cost, value, branchName }] }` (reporte).
- **Server Actions `src/app/(app)/operaciones/inventario/actions.ts`** — `registerAdjustmentAction` (Zod + `canManageStock`; `revalidatePath` de inventario, detalle de producto, dashboard). Patrón `ctx()`/`FormState`/`zodErrors`.
- **Cambios en Productos:** `productCreateSchema`/`productUpdateSchema` ganan `minStock` (coerce ≥ 0, default 0); `mutations.productRow` mapea `min_stock`; el form de producto añade el campo (solo `good`); el detalle de producto muestra el panel de stock.

**Flujo de un ajuste:** Inventario o detalle de producto → panel `stock-adjust-form` → `registerAdjustmentAction` → Zod → `canManageStock` → `registerAdjustment` → insert `stock_movement` → trigger actualiza `stock_levels` → `revalidatePath`.

## UI

Lenguaje visual Plan 2. Reusa `formatMoney`, `getTenantCurrency`, `EmptyState`.

- **`/operaciones/inventario` (gestión)** — server component; `listStock` desde `searchParams` (q, status, branch). Toolbar: buscador (nombre/SKU) + filtro estado (Todos/Bajo/Agotado) + selector de sucursal (visible a back-office; fijo a su sucursal para operativos). Tabla escritorio (Producto · SKU · Existencia · Mínimo · Estado) / cards móvil; fila → detalle del producto. Botón "Registrar movimiento" (solo `canManageStock`). Empty state "Aún no hay productos con stock".
- **`stock-adjust-form.tsx`** (panel inline, PWA-safe): producto (preseleccionado si viene del detalle; si no, selector), sucursal, **Entrada/Salida**, cantidad (>0), motivo → `registerAdjustmentAction`; errores Zod en línea; `useEffect` colapsa tras éxito.
- **Detalle de producto (`/operaciones/productos/[id]`)** — reemplaza el empty state "Existencias/Movimientos" (`product-stock-panel.tsx`): para `good`, existencias **por sucursal** + mínimo + últimos movimientos (`movements-history`) + botón **Ajustar** (`canManageStock`); para `service`, nota "Los servicios no llevan stock".
- **Form de producto (nuevo/editar)** — nuevo campo **Stock mínimo** (default 0), visible para `good`.
- **`/reportes/inventario` (valorización, back-office)** — reemplaza placeholder: total valorizado + desglose por producto (existencia × costo). Gateado por recurso `reportes` (redirige a `/dashboard` si no).
- **Componentes** `src/components/inventario/`: `stock-table.tsx`, `stock-row-card.tsx`, `stock-toolbar.tsx`, `stock-status-badge.tsx`, `stock-adjust-form.tsx`, `movements-history.tsx`, `product-stock-panel.tsx`.
- **Nav (`src/lib/nav.ts`):** nuevo item **"Inventario"** en la sección Operaciones (`/operaciones/inventario`, icono `Boxes`), visible a almacén y back-office (recurso `operaciones`). El item "Inventario" de Reportes (`/reportes/inventario`) queda como reporte de valorización.

## Dashboard

En `src/app/(app)/dashboard/page.tsx` (degradación segura, como los módulos previos):
- **"Valor de inventario"** ← `stockKpi.value`, gateado a `canManageProducts(role)` (ve costo); vendedor/cajero lo ven vacío.
- **"Bajo stock" / "Bajo stock / agotados"** ← `stockKpi.lowCount + stockKpi.outCount`.
- **"Estado del inventario"** — el `ChartCard` vacío se alimenta con `inventoryStatusBreakdown` (En stock / Bajo / Agotado) como lista de conteos (mismo estilo que el widget "Productos por categoría", sin librería de gráficos).

## Testing

- **Unit:** `permissions.test.ts` (`canManageStock` = almacén + back-office, NO vendedor/cajero); `schema.test.ts` (`quantity>0`, `direction ∈ {in,out}`, `productId`/`branchId` requeridos).
- **Integración (Supabase local + RLS + trigger, serial, patrón Plan 1):**
  - `registerAdjustment` entrada suma y salida resta en `stock_levels` (vía trigger); un ajuste que deja negativo es permitido.
  - **Emitir una venta** con producto `good` (qty N) baja la existencia en N; un ítem `service` o sin `product_id` no genera movimiento.
  - **Anular la venta** repone la existencia (movimiento `sale_void`).
  - **Sobreventa:** emitir más que el stock deja nivel negativo, sin error.
  - `listStock` clasifica estados (bajo/agotado) según `min_stock`; `stockKpi.value = Σ qty×cost`; `lowCount`/`outCount` correctos.
  - **Scoping por sucursal:** un ajuste en la sucursal A no aparece en el stock que ve un operativo de la sucursal B; back-office ve ambas.
  - Aislamiento entre tenants; RLS: ajuste (insert laxo) funciona para almacén; `stock_levels` de solo lectura scopeada.
  - **Regresión:** los tests de ventas/cobros siguen verdes (ahora las ventas también crean movimientos de stock).
- **E2E manual:** cargar stock inicial con un ajuste de entrada; ver existencias en Inventario y en el detalle de producto; emitir una venta y ver bajar el stock; anular y ver reponerse; sobreventa (negativo); filtro bajo/agotado con min_stock; reporte de valorización; dashboard (Valor de inventario, Bajo stock, Estado del inventario); role-gating (vendedor/cajero ven existencias pero no "Registrar movimiento"; almacén sí ajusta; `/reportes/inventario` redirige a no-back-office).
- **Regresión:** suite existente verde + `npm run build` limpio.

## Fuera de alcance (planes posteriores)

Transferencias entre sucursales; compras / órdenes a proveedores (entradas por compra); lotes y vencimiento; costeo promedio móvil (la valorización usa `cost` actual del producto); conteo físico / inventario cíclico; reservas de stock; stock mínimo por sucursal; historial de movimientos global paginado (este plan lo muestra por producto).
