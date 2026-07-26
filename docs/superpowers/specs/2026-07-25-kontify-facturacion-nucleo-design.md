# Kontify — Facturación / Núcleo de Ventas (Plan 5): Diseño

> Spec de diseño. Tercer módulo operativo, sobre la Fundación (Plan 1), el shell (Plan 2), Clientes (Plan 3) y Productos (Plan 4), todos en `master`.
> Fuente de verdad visual: `docs/design/design-system.md`. Espeja el patrón de Clientes/Productos. Decisiones acordadas en brainstorming 2026-07-25.

## Objetivo

Registrar **documentos de venta internos (no fiscales)** por empresa: crear (borrador), emitir, ver, editar borradores y anular; con líneas de producto, descuentos por línea y global, impuesto por línea, totales, correlativo por empresa asignado al emitir, y pago contado/crédito con saldo. Alimenta el dashboard (Ventas del mes, Ticket promedio, Por cobrar) y los hooks "Historial de compras"/"Por cobrar" del detalle de Cliente. Reemplaza el placeholder de `/operaciones/facturacion`.

**Fuera de este plan (núcleo):** abonos parciales, PDF/impresión, descuento de stock, Utilidad/margen y reportes, Presupuestos. Ver "Fuera de alcance".

## Contexto y punto de partida

- **Plan 1 (`master`):** tenancy con RLS. `current_tenant_id()`/`current_user_role()` SECURITY DEFINER (leen `memberships`). Tablas `tenants`, `branches`, `profiles`, `memberships (user_id, tenant_id, role, branch_id)`. RPC `bootstrap_tenant`. Roles: owner, admin, administrativo, vendedor, cajero, almacen; `isBranchScoped` = vendedor/cajero/almacen. GRANTs de tabla a `authenticated` son obligatorios para que RLS deje leer (lección `0005_grants.sql`). Tests de integración serial (`fileParallelism:false`).
- **Plan 2 (`master`):** shell dual-tier, dashboard con `KpiCard`/`ChartCard` presentacionales y empty states honestos. `src/lib/nav.ts` gateado por rol (`canAccess`), item "Facturación" → `/operaciones/facturacion` (recurso `operaciones`). FAB "Vender" (squircle) y barra inferior "Vender" existen pero no navegan a ningún lado aún.
- **Plan 3 (`master`):** Clientes. `clients` (activos), `client_types`. Detalle de cliente con empty states "Historial de compras" y "Por cobrar" esperando Facturación. Patrón de módulo: `src/lib/clientes/*` (schema/permissions/queries/mutations) + Server Actions (`ctx()`, `FormState`, `zodErrors`) + UI tabla/cards/toolbar/badge.
- **Plan 4 (`master`):** Productos. `products` (name, sku, price, cost, `tax_rate_id`→`tax_rates`, unit, active, kind good/service), `product_categories`, `tax_rates` (name, rate, is_default, active). `tenants.currency` (moneda por empresa, default USD) + helper `src/lib/format.ts` `formatMoney(amount, currency)` (locale `es-VE`). `cost` es sensible: oculto a vendedor/cajero.
- **No existe todavía:** ningún registro de ventas, ni `current_user_branch_id()`, ni numeración correlativa.

## Decisiones de alcance (acordadas en brainstorming)

1. **Solo núcleo de ventas.** Crear/listar/ver/editar-borrador/anular. Sin abonos parciales (Cobros), sin PDF, sin stock.
2. **No fiscal.** Documento de venta interno; sin numeración fiscal ni integración tributaria.
3. **Correlativo por empresa + venta ligada a sucursal.** Número secuencial único por tenant, asignado **al emitir** (los borradores no gastan correlativo). Cada venta guarda `branch_id` (sucursal donde se vendió). Operativos ven/crean solo las de su sucursal; owner/admin/administrativo ven todas.
4. **Estados: borrador / emitida / anulada.** Se crea como borrador editable (no cuenta para nada); Emitir la vuelve inmutable y contable; Anular revierte una emitida sin borrarla.
5. **Descuentos por línea y global, en porcentaje (%).** El descuento global prorratea sobre las líneas antes del impuesto.
6. **Pago contado/crédito con saldo.** Al emitir: Contado (saldo 0, `payment_method` opcional) o Crédito (saldo = total). Campo `paid_amount` para que el futuro módulo de Cobros registre abonos encima. "Por cobrar" = Σ saldos pendientes.
7. **Impuesto por línea prefijado del producto, editable.** Precio también editable por línea. `tax_rate` se guarda como snapshot % en la línea.
8. **Permisos:** crear/emitir → owner/admin/administrativo/vendedor/cajero (almacén no vende). Anular → owner/admin. Borrar borrador → quien puede vender.
9. **Sin costo en la venta.** No se snapshotea `cost` en `sale_items` (evita fuga a vendedor/cajero). Utilidad/margen se difiere a Reportes.
10. **Arquitectura:** función pura de totales + Server Actions + capa de datos testeable (`src/lib/ventas/*`). Espeja Clientes/Productos.

## Nombres

Lib `src/lib/ventas/*`; tablas `sales`/`sale_items`/`sale_counters` (inglés, como `clients`/`products`); componentes `src/components/ventas/`; ruta `/operaciones/facturacion`.

## Modelo de datos

Enum nuevo:
```
create type public.sale_status as enum ('draft','issued','void');   -- borrador/emitida/anulada
```

### `sales` (cabecera)
```
id                uuid pk default gen_random_uuid()
tenant_id         uuid not null → tenants(id) on delete cascade
number            bigint                                  -- correlativo por empresa; NULL en borrador, asignado al emitir
branch_id         uuid not null → branches(id) on delete restrict
client_id         uuid → clients(id) on delete set null   -- NULL = "Consumidor final"
status            public.sale_status not null default 'draft'
currency          text not null                           -- snapshot de tenants.currency
global_discount_pct numeric(5,2) not null default 0
subtotal          numeric(14,2) not null default 0        -- Σ netos de línea (tras desc. de línea, antes de global e impuesto)
discount_total    numeric(14,2) not null default 0        -- Σ desc. de línea + desc. global
tax_total         numeric(14,2) not null default 0
total             numeric(14,2) not null default 0
paid_amount       numeric(14,2) not null default 0        -- saldo = total - paid_amount
payment_method    text                                    -- efectivo/transferencia/… (contado), opcional
issued_at         timestamptz
notes             text
created_by        uuid → auth.users(id) on delete set null
created_at        timestamptz not null default now()
updated_at        timestamptz not null default now()
índices: (tenant_id, status), (tenant_id, client_id), (tenant_id, branch_id)
único parcial: unique (tenant_id, number) where number is not null
```

### `sale_items` (líneas — guarda inputs, no totales de línea)
```
id            uuid pk default gen_random_uuid()
tenant_id     uuid not null → tenants(id) on delete cascade   -- denormalizado para RLS
sale_id       uuid not null → sales(id) on delete cascade
product_id    uuid → products(id) on delete set null
description   text not null                                   -- snapshot del nombre del producto
quantity      numeric(14,2) not null
unit_price    numeric(14,2) not null                          -- editable, prefill del producto
discount_pct  numeric(5,2) not null default 0                 -- descuento de línea %
tax_rate      numeric(5,2) not null default 0                 -- snapshot %, editable, prefill del producto
position      int not null default 0
índice: (sale_id)
```
Los totales de línea (neto, impuesto) NO se guardan: se recomputan con `computeSaleTotals`. En la cabecera se **congelan** los totales rodados al guardar/emitir. **No se guarda `cost`.**

### `sale_counters` (correlativo por empresa)
```
tenant_id   uuid primary key → tenants(id) on delete cascade
last_number bigint not null default 0
```

### Numeración — RPC `next_sale_number()`
Función SECURITY DEFINER, atómica y gapless por empresa; asigna el siguiente número al emitir:
```sql
create or replace function public.next_sale_number()
returns bigint language plpgsql security definer set search_path = public as $$
declare v_tenant uuid; v_num bigint;
begin
  v_tenant := public.current_tenant_id();
  if v_tenant is null then raise exception 'no tenant'; end if;
  insert into public.sale_counters(tenant_id, last_number)
    values (v_tenant, 1)
    on conflict (tenant_id) do update set last_number = public.sale_counters.last_number + 1
    returning last_number into v_num;
  return v_num;
end; $$;
```

### Helper `current_user_branch_id()`
```sql
create or replace function public.current_user_branch_id()
returns uuid language sql stable security definer set search_path = public as $$
  select branch_id from public.memberships where user_id = auth.uid() limit 1;
$$;
```
(Owner/admin/administrativo tienen `branch_id = NULL`; el scoping por sucursal solo aplica a operativos, ver RLS.)

### RLS y GRANTs
La barrera real es RLS; el menú/UI solo oculta. Rol vía `current_user_role()`.

- `sales` **enable RLS**:
  - **SELECT:** `tenant_id = current_tenant_id() AND ( current_user_role() in ('owner','admin','administrativo') OR branch_id = current_user_branch_id() )` — back-office ve todas; vendedor/cajero solo su sucursal.
  - **INSERT / UPDATE:** `tenant_id = current_tenant_id() AND current_user_role() in ('owner','admin','administrativo','vendedor','cajero')` (almacén excluido).
  - **DELETE:** misma condición de rol que INSERT (para borrar borradores; la restricción "solo draft" se refuerza en la capa de servicio).
- `sale_items` **enable RLS**:
  - **SELECT:** `tenant_id = current_tenant_id() AND exists ( select 1 from public.sales s where s.id = sale_id and ( current_user_role() in ('owner','admin','administrativo') OR s.branch_id = current_user_branch_id() ) )` — espeja la visibilidad por sucursal de la venta padre, para que un operativo NO pueda leer ítems de ventas de otra sucursal consultando la tabla directamente.
  - **INSERT / UPDATE / DELETE:** `tenant_id = current_tenant_id() AND current_user_role() in ('owner','admin','administrativo','vendedor','cajero')` (ocurren al crear/editar el borrador por el mismo usuario; la restricción "solo draft" la refuerza la capa de servicio).
- La transición de estado (draft→issued, issued→void) y "solo owner/admin anula" / "solo draft se edita o borra" se refuerzan en las **Server Actions** (`canVoidSale`, chequeo de `status`).
- GRANTs a `authenticated`: `select, insert, update, delete` en `sales` y `sale_items`; `select, insert, update` en `sale_counters`.

Migraciones nuevas (forward-only, continúan la numeración de Productos): `0012_sales_schema.sql` (enum + `sales` + `sale_items` + `sale_counters` + índices), `0013_sales_rls.sql` (helper `current_user_branch_id` + policies + grants), `0014_sale_number_rpc.sql` (función `next_sale_number` + grant execute a `authenticated`).

## Cálculo de totales — `src/lib/ventas/totals.ts` (función pura)

`computeSaleTotals(items, globalDiscountPct)` con `items: { quantity, unitPrice, discountPct, taxRate }[]`. Algoritmo:

```
base_línea       = quantity * unitPrice
desc_línea       = base_línea * (discountPct/100)
neto_línea       = base_línea - desc_línea                 -- subtotal de línea (antes de impuesto)
subtotal_bruto   = Σ neto_línea
desc_global      = subtotal_bruto * (globalDiscountPct/100)
factor_global    = 1 - globalDiscountPct/100
neto_línea_final = neto_línea * factor_global              -- prorrateo del desc. global antes del impuesto
tax_línea        = neto_línea_final * (taxRate/100)
tax_total        = Σ tax_línea
subtotal (cab.)  = subtotal_bruto
discount_total   = Σ desc_línea + desc_global
total            = subtotal_bruto - desc_global + tax_total
```

Devuelve `{ subtotal, discountTotal, taxTotal, total, lines: [{ neto, tax, total }] }`. **Redondeo:** helper `round2` a 2 decimales aplicado a cada monto; el impuesto se calcula sobre el neto ya prorrateado para que `Σ tax_línea` cuadre con `total`. Es la **única fuente de verdad** de montos: la usan la UI (totales en vivo), las mutaciones (congelan la cabecera) y las queries (recomputan líneas al mostrar).

## Capa de servidor (`src/lib/ventas/*`)

- **`totals.ts`** — `computeSaleTotals` + `round2` (sin dependencias).
- **`schema.ts`** — Zod:
  - `saleLineSchema`: `productId` (uuid|null), `description` (1–160), `quantity` (>0), `unitPrice` (≥0), `discountPct` (0–100), `taxRate` (0–100).
  - `saleSaveSchema` (guardar borrador): `clientId` (uuid|null), `branchId` (uuid), `globalDiscountPct` (0–100), `notes` (opcional), `items` (array de `saleLineSchema`, permite 0 líneas).
  - `saleEmitSchema`: como `saleSaveSchema` pero `items` mín. 1.
  - `emitSchema`: `paymentType` ∈ {`contado`,`credito`}, `paymentMethod` (opcional, solo contado).
  - Tipos con `z.infer`.
- **`permissions.ts`** — puras: `canSell(role)` → `role ∈ {owner,admin,administrativo,vendedor,cajero}`; `canVoidSale(role)` → `owner|admin`.
- **`queries.ts`** — reciben Supabase (RLS-scoped):
  - `listSales(sb, {search, status, payment, page, pageSize})` — paginado; `search` por número o nombre de cliente; `status` ∈ borrador|emitida|anulada|todos; `payment` ∈ pendientes|todos. Filas `{id, number, status, clientName, branchName, total, balance, currency, issuedAt, createdAt}`.
  - `getSale(sb, id)` — cabecera + `sale_items` (ordenados por `position`) + nombres de cliente/sucursal; recomputa líneas con `computeSaleTotals`.
  - `salesKpi(sb)` → `{ monthTotal, avgTicket }` (ventas `issued` del mes en curso). **Degradación segura** → `{monthTotal:0, avgTicket:0}`.
  - `receivablesTotal(sb)` → `{ total }` (Σ `total - paid_amount` de `issued`, excluye `void`). **Degradación segura** → `{total:0}`.
  - `salesByClient(sb, clientId)` → `{ list, purchasedTotal, receivable }` (ventas `issued` del cliente, para el detalle de Cliente). **Degradación segura** → listas/ceros vacíos.
- **`mutations.ts`** — reciben Supabase (confían en RLS); recomponen totales con `computeSaleTotals` y **congelan** la cabecera:
  - `createDraft(sb, tenantId, userId, input)` → inserta `sales` (status draft, `currency` = snapshot de `tenants.currency`, totales calculados) + `sale_items`; devuelve id.
  - `updateDraft(sb, id, input)` → solo si status='draft'; reescribe cabecera + **reemplaza ítems** (delete todos + insert nuevos, por simplicidad/consistencia).
  - `deleteDraft(sb, id)` → solo si status='draft' (`.delete()`; ítems por cascade).
  - `emitSale(sb, id, {paymentType, paymentMethod})` → solo draft con ≥1 línea: `number = rpc('next_sale_number')`, `status='issued'`, `issued_at=now()`, `paid_amount = paymentType==='contado' ? total : 0`, `payment_method`.
  - `voidSale(sb, id)` → solo si status='issued': `status='void'`.
  - La guarda de `status` se hace leyendo el registro antes de mutar (o con `.eq('status','draft')` en el UPDATE/DELETE); si 0 filas afectadas, la acción devuelve error.
- **`src/app/(app)/operaciones/facturacion/actions.ts`** — `"use server"` (patrón `ctx()`/`FormState`/`zodErrors` idéntico a Clientes/Productos). El builder envía las líneas como un único campo hidden `items` con `JSON.stringify(lines)`; la acción lo parsea (`JSON.parse` en try/catch) y valida con Zod (`z.array(saleLineSchema)`).
  - `saveDraftAction` (nuevo) / `updateDraftAction`: Zod `saleSaveSchema`, exige `canSell`; llaman `createDraft`/`updateDraft`; `revalidatePath`; `redirect` al detalle.
  - `emitSaleAction`: Zod `saleEmitSchema` + `emitSchema`, exige `canSell`, valida ≥1 línea; llama `emitSale`; `revalidatePath` de lista/detalle/`/dashboard`/`/clientes/[clientId]`; `redirect` al detalle.
  - `deleteDraftAction`: exige `canSell`; `redirect` a la lista.
  - `voidSaleAction`: exige `canVoidSale` (defensa extra además del botón oculto); `revalidatePath` de lista/detalle/dashboard/cliente.

**Flujo de escritura:** builder (client) arma líneas en estado local → totales en vivo con `computeSaleTotals` → submit con `items` serializado → Server Action → Zod → `canSell` → `mutations.*` (recomputa y congela) → RLS → `revalidatePath`.

## UI

Lenguaje visual del Plan 2 (tokens Teal & Slate, Radix, `EmptyState`, `formatMoney`). Ruta base `/operaciones/facturacion`.

- **Lista `/operaciones/facturacion`** — server component; lee `listSales` desde `searchParams` (q, status, payment, page). Tabla escritorio (Nº · Fecha · Cliente · Total · Saldo/Pago · Estado) / cards móvil; fila cliqueable → detalle; paginación server-side. Toolbar: buscador (número/cliente) + filtro estado (Borradores/Emitidas/Anuladas/Todas) + filtro pago (Pendientes/Todas). Botón "Nueva venta". Empty state "Aún no hay ventas" + CTA. Chips de estado con estilos por estado y **fallback seguro** para estados no mapeados (lección `feedback_cdr4g_invoice_status`).
- **Builder `/operaciones/facturacion/nueva` y `/[id]/editar`** — client component `sale-builder.tsx`:
  - Selector de **cliente** (buscador sobre clientes activos; opción "Consumidor final" = null).
  - Selector de **sucursal** visible solo para owner/admin/administrativo (default: sucursal principal `is_main`); fijo/oculto para operativos (su `branch_id`).
  - **Líneas:** añadir producto (buscador sobre productos activos → prefill `description`/`unit_price`/`tax_rate` del producto), editar cantidad/precio/descuento%/tasa%, quitar línea; muestra el neto de línea en vivo.
  - **Descuento global %** + panel de totales en vivo (Subtotal · Descuentos · Impuesto · **Total**) con `computeSaleTotals` en el cliente.
  - **Acciones:** "Guardar borrador" (`saveDraft`/`updateDraft`) y "Emitir" que abre `emit-dialog` (Contado con método de pago opcional, o Crédito) → `emitSale`. Errores Zod en línea.
- **Detalle `/operaciones/facturacion/[id]`** — `sale-document.tsx`: vista tipo documento (empresa/sucursal, "Nº X" o "BORRADOR", cliente, líneas, totales, estado de pago + saldo). Acciones según estado y rol:
  - `draft`: Editar · Emitir · Eliminar borrador.
  - `issued`: Anular (solo owner/admin); muestra Pagada/Pendiente + saldo; nota "Los abonos llegan con el módulo de Cobros".
  - `void`: chip "Anulada", solo lectura.
- **Cliente `/clientes/[id]`** — reemplaza los empty states por datos reales de `salesByClient`: **"Historial de compras"** (lista de ventas emitidas) y **"Por cobrar"** (saldo del cliente).
- **FAB "Vender" y barra inferior "Vender"** — se cablean a `/operaciones/facturacion/nueva`.

**Componentes** en `src/components/ventas/`: `sales-table.tsx`, `sale-row-card.tsx`, `sales-toolbar.tsx`, `status-badge.tsx`, `sale-builder.tsx` (+ subcomponentes `line-row.tsx`, `client-picker.tsx`, `product-picker.tsx`, `emit-dialog.tsx`), `sale-document.tsx`. Los botones de escritura se ocultan según rol (barrera dura = RLS + Server Action).

## Dashboard

En `src/app/(app)/dashboard/page.tsx`, reemplazar placeholders con datos reales (degradación segura, como Clientes/Productos):
- KPI **"Ventas del mes"** ← `salesKpi.monthTotal` (formateado con `formatMoney` y la moneda del tenant).
- KPI **"Ticket promedio"** ← `salesKpi.avgTicket`.
- KPI **"Por cobrar"** ← `receivablesTotal.total`.
- Utilidad del mes, Ventas de la semana, Top productos → siguen en empty state (llegan con Reportes).

## Testing

- **Unit:** `totals.test.ts` (exhaustivo: sin descuentos; solo desc. línea; solo desc. global; ambos combinados; tasa exenta 0; cantidades decimales; venta vacía → todo 0; verificación de que `Σ tax_línea` cuadra con `total` y del prorrateo del desc. global antes del impuesto). `permissions.test.ts` (`canSell` incluye vendedor/cajero y NO almacen; `canVoidSale` solo owner/admin). `schema.test.ts` (línea exige `quantity>0`; `saleEmitSchema` exige ≥1 línea; `emitSchema` valida `paymentType`).
- **Integración (Supabase local + RLS, serial, patrón Plan 1):**
  - Aislamiento: tenant A no ve ventas de B.
  - **Scoping por sucursal:** vendedor de sucursal A no ve una venta de sucursal B del mismo tenant; back-office (administrativo) sí ve ambas.
  - Gateo por rol: `almacen` no puede insertar en `sales` (RLS niega).
  - Flujo: crear borrador → emitir asigna número; dos emisiones → números consecutivos (RPC `next_sale_number`).
  - Pago: contado deja `paid_amount = total` (saldo 0); crédito deja `paid_amount = 0` (saldo = total).
  - `salesKpi`/`receivablesTotal`/`salesByClient` devuelven montos correctos; anular saca la venta de "por cobrar" y de los KPIs.
  - Borrar un borrador elimina sus `sale_items` (cascade).
- **E2E manual:** lista con filtros; crear venta (cliente + líneas + descuentos), guardar borrador, editar, emitir contado y crédito, ver documento, anular (owner); "Consumidor final"; role-gating (almacén sin acceso a crear; vendedor no ve el botón Anular; vendedor de otra sucursal no ve la venta); dashboard con Ventas/Ticket/Por cobrar reales; detalle de Cliente con historial y por cobrar; FAB "Vender" navega a nueva venta.
- **Regresión:** suite existente verde + `npm run build` limpio.

## Fuera de alcance (planes posteriores)

Abonos parciales y pantalla completa de Cuentas por cobrar (módulo Cobros); PDF/impresión y envío por email/WhatsApp; descuento de stock al vender (Inventario); Utilidad/margen y reportes de ventas (Reportes); Presupuestos (documento aparte, su propio plan); multi-moneda con tasa de cambio; devoluciones / notas de crédito; edición de ventas ya emitidas; selección de método de pago con catálogo configurable; series de numeración por sucursal.
