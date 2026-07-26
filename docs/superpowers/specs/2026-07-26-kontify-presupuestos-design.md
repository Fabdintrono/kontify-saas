# Kontify — Presupuestos / Cotizaciones (Plan 8): Diseño

> Spec de diseño. Sexto módulo operativo, sobre Fundación (Plan 1), shell (Plan 2), Clientes (Plan 3), Productos (Plan 4), Facturación (Plan 5), Cobros (Plan 6) e Inventario (Plan 7), todos en `master`.
> Fuente de verdad visual: `docs/design/design-system.md`. Espeja el patrón del núcleo de Ventas. Decisiones acordadas en brainstorming 2026-07-26.

## Objetivo

Crear documentos de cotización (presupuestos) por empresa: líneas de producto con descuentos e impuesto, totales, correlativo propio, vigencia opcional, y ciclo borrador→enviado→aceptado/rechazado. Lo central: **convertir un presupuesto en una venta borrador** (copia cliente + líneas al módulo de Ventas). **Sin efecto contable**: no toca stock, cobros ni el correlativo de ventas. Reemplaza el placeholder de `/operaciones/presupuestos`.

## Contexto y punto de partida

- **Plan 5 (`master`):** `sales`/`sale_items`, función pura `computeSaleTotals` (`src/lib/ventas/totals.ts`), `saleLineSchema` (`src/lib/ventas/schema.ts`), `canSell` (`src/lib/ventas/permissions.ts`), patrón de correlativo (`sale_counters` + RPC `next_sale_number`), builder con líneas + emit inline, RLS con scoping por sucursal (`sales_select`/`insert`/`update`/`delete` + branch scope en escritura tras 0015), helper `current_user_branch_id()`, `createDraft(sb, tenantId, userId, currency, input)` en `src/lib/ventas/mutations.ts`. Pickers `client-picker`/`product-picker` en `src/components/ventas/`.
- **Plan 4:** `getTenantCurrency`, `formatMoney`. **Plan 1:** `current_tenant_id()`/`current_user_role()`, GRANTs obligatorios, tests de integración serial.
- **Nav:** item "Presupuestos" ya existe en Operaciones (`/operaciones/presupuestos`, recurso `operaciones`).
- **No existe todavía:** ninguna tabla de presupuestos ni su correlativo.

## Decisiones de alcance (acordadas)

1. **Documento sin efecto contable.** No mueve stock, no crea cobros, no consume el correlativo de ventas.
2. **Estados:** `draft` → `sent` → `accepted`/`rejected`, más `converted`. **Vencido** es derivado (`valid_until < hoy` y estado `sent`/`accepted`; no bloquea convertir).
3. **Conversión → venta borrador.** Copia cliente + líneas + descuentos al módulo de Ventas como un `sales` en `status='draft'` editable; el usuario la emite normalmente. El presupuesto queda `converted` y enlazado (`converted_sale_id`). **Conversión única**, desde `sent` o `accepted`.
4. **Serie propia por empresa**, asignada al **Enviar** (los borradores no consumen número).
5. **Vigencia opcional** (`valid_until`).
6. **Permisos:** reusa `canSell` (owner/admin/administrativo/vendedor/cajero; almacén no cotiza); scoping por sucursal como en ventas. Crear/enviar/aceptar/rechazar/convertir requieren `canSell`.
7. **Reuso máximo:** misma `computeSaleTotals`, misma forma de línea (`saleLineSchema`), mismos pickers; convertir usa `createDraft` de Ventas.
8. **Arquitectura:** capa testeable `src/lib/presupuestos/*` + Server Actions. Espeja el núcleo de Ventas.

## Modelo de datos

Enum nuevo:
```
create type public.quote_status as enum ('draft','sent','accepted','rejected','converted');
```

### `quotes` (cabecera — espeja `sales`)
```
id                uuid pk default gen_random_uuid()
tenant_id         uuid not null → tenants(id) on delete cascade
number            bigint                                   -- correlativo propio; NULL en borrador, asignado al Enviar
branch_id         uuid not null → branches(id) on delete restrict
client_id         uuid → clients(id) on delete set null    -- NULL = "Consumidor final"
status            public.quote_status not null default 'draft'
currency          text not null                            -- snapshot de tenants.currency
global_discount_pct numeric(5,2) not null default 0
subtotal          numeric(14,2) not null default 0
discount_total    numeric(14,2) not null default 0
tax_total         numeric(14,2) not null default 0
total             numeric(14,2) not null default 0
valid_until       date                                     -- vigencia opcional
converted_sale_id uuid → sales(id) on delete set null      -- venta borrador creada al convertir
notes             text
created_by        uuid → auth.users(id) on delete set null
created_at        timestamptz not null default now()
updated_at        timestamptz not null default now()
índices: (tenant_id, status), (tenant_id, client_id)
único parcial: unique (tenant_id, number) where number is not null
```

### `quote_items` (líneas — idénticas a `sale_items`)
```
id           uuid pk default gen_random_uuid()
tenant_id    uuid not null → tenants(id) on delete cascade   -- denormalizado para RLS
quote_id     uuid not null → quotes(id) on delete cascade
product_id   uuid → products(id) on delete set null
description  text not null
quantity     numeric(14,2) not null
unit_price   numeric(14,2) not null
discount_pct numeric(5,2) not null default 0
tax_rate     numeric(5,2) not null default 0
position     int not null default 0
índice: (quote_id)
```

### `quote_counters` + RPC `next_quote_number()`
Serie propia por empresa (copia exacta de `sale_counters`/`next_sale_number`, tablas y funciones separadas):
```
create table public.quote_counters (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  last_number bigint not null default 0
);
```
```sql
create or replace function public.next_quote_number()
returns bigint language plpgsql security definer set search_path = public as $$
declare v_tenant uuid; v_num bigint;
begin
  v_tenant := public.current_tenant_id();
  if v_tenant is null then raise exception 'no tenant'; end if;
  insert into public.quote_counters(tenant_id, last_number)
    values (v_tenant, 1)
    on conflict (tenant_id) do update set last_number = public.quote_counters.last_number + 1
    returning last_number into v_num;
  return v_num;
end; $$;
```

### Estados derivados (no columnas)
**Vencido** = `valid_until is not null AND valid_until < current_date AND status in ('sent','accepted')`.

### RLS y GRANTs
Espeja `sales` (rol vía `current_user_role()`, scoping por sucursal):
- `quotes` **enable RLS**:
  - **SELECT:** `tenant_id = current_tenant_id() AND ( current_user_role() in ('owner','admin','administrativo') OR branch_id = current_user_branch_id() )`.
  - **INSERT / UPDATE / DELETE:** `tenant_id = current_tenant_id() AND current_user_role() in ('owner','admin','administrativo','vendedor','cajero') AND ( current_user_role() in ('owner','admin','administrativo') OR branch_id = current_user_branch_id() )` (operativos solo su sucursal).
- `quote_items` **enable RLS**:
  - **SELECT:** `tenant_id = current_tenant_id() AND exists ( select 1 from public.quotes q where q.id = quote_id and ( current_user_role() in ('owner','admin','administrativo') OR q.branch_id = current_user_branch_id() ) )`.
  - **INSERT / UPDATE / DELETE:** `tenant_id = current_tenant_id() AND current_user_role() in ('owner','admin','administrativo','vendedor','cajero')`.
- `quote_counters` **enable RLS**: política `for all using/with check (tenant_id = current_tenant_id())` (como `sale_counters`).
- Las transiciones de estado (draft→sent, sent→accepted/rejected, →converted) y la conversión única se refuerzan en las **Server Actions** + guards de `status`/`converted_sale_id` en las mutaciones.
- GRANTs a `authenticated`: `select, insert, update, delete` en `quotes` y `quote_items`; `select, insert, update` en `quote_counters`.

Migraciones nuevas (forward-only): `0023_quotes_schema.sql` (enum + `quotes` + `quote_items` + `quote_counters` + índices), `0024_quotes_rls.sql` (helper reusado `current_user_branch_id` ya existe; policies + grants), `0025_quote_number_rpc.sql` (función + grant execute a `authenticated`).

## Capa de servidor (`src/lib/presupuestos/*`)

- **`schema.ts`** — reusa `saleLineSchema` de `@/lib/ventas/schema`:
  - `quoteSaveSchema`: `clientId` (uuid/guid|null), `branchId` (uuid/guid), `globalDiscountPct` (0–100), `validUntil` (fecha `YYYY-MM-DD` opcional|null), `notes` (opcional), `items` (array de `saleLineSchema`, permite 0).
  - `quoteSendSchema`: como el anterior pero `items` mín. 1.
  - `quoteStatusSchema`: `status` ∈ {`accepted`,`rejected`}.
  - Tipos con `z.infer` (`QuoteSaveInput`).
- **Permisos:** reusa `canSell` de `@/lib/ventas/permissions` (no se crea archivo nuevo).
- **`mutations.ts`** (recomponen totales con `computeSaleTotals` y congelan la cabecera; el reemplazo de ítems es delete+insert como en ventas):
  - `createDraft(sb, tenantId, userId, currency, input)` → inserta `quotes` (draft, currency snapshot, totales, `valid_until`) + `quote_items`; devuelve id.
  - `updateDraft(sb, id, tenantId, input)` → solo `draft`; reescribe cabecera + reemplaza ítems.
  - `deleteDraft(sb, id)` → solo `draft`.
  - `sendQuote(sb, id)` → solo `draft` con ≥1 línea: `number = rpc('next_quote_number')`, `status='sent'`.
  - `setQuoteStatus(sb, id, status)` → solo `sent`: pasa a `accepted`|`rejected`.
  - `convertToSale(sb, tenantId, userId, currency, id)` → solo si `status ∈ {sent,accepted}` y `converted_sale_id is null`: lee `quote_items`, mapea a input de venta, llama **`createDraft` de `@/lib/ventas/mutations`**, luego `update quotes set status='converted', converted_sale_id=<saleId>`; devuelve el `saleId`. Guard de conversión única (`.is('converted_sale_id', null)` en el UPDATE + chequeo de filas).
- **`queries.ts`** (RLS-scoped, degradación segura): `listQuotes(sb, {search, status, page, pageSize})` (search por número/cliente como en ventas; status ∈ borradores|enviados|aceptados|rechazados|convertidos|todos); `getQuote(sb, id)` (cabecera + ítems ordenados + recompute con `computeSaleTotals` + nombres de cliente/sucursal + `converted_sale_id`).
- **Server Actions `src/app/(app)/operaciones/presupuestos/actions.ts`** (`"use server"`, patrón `ctx()`/`FormState`/`zodErrors`; una acción con intent como en ventas):
  - `submitQuoteAction` (intent `save`|`send`, exige `canSell`; el builder envía `items` como JSON; crea-o-actualiza borrador y, si `send`, valida ≥1 línea y llama `sendQuote`; `revalidatePath` + `redirect` al detalle).
  - `deleteQuoteAction` (exige `canSell`; `redirect` a la lista).
  - `setQuoteStatusAction` (exige `canSell`; aceptar/rechazar).
  - `convertQuoteAction` (exige `canSell`; llama `convertToSale`; `redirect` a `/operaciones/facturacion/[saleId]/editar`).

**Flujo de conversión:** detalle → "Convertir en venta" → `convertQuoteAction` → `convertToSale` (crea venta borrador vía Ventas, marca el presupuesto `converted` + `converted_sale_id`) → redirige al **editor de la venta** para revisar y emitir.

## UI

Lenguaje visual Plan 2. Reusa `formatMoney`, `getTenantCurrency`, `EmptyState`, `ClientPicker`/`ProductPicker` de `@/components/ventas`.

- **`/operaciones/presupuestos` (lista)** — server component; `listQuotes` desde `searchParams` (q, status, page). Tabla escritorio (Nº · Fecha · Cliente · Total · Vigencia · Estado) / cards móvil; fila → detalle; paginación. Toolbar: buscador (número/cliente) + filtro estado. Botón "Nuevo presupuesto". Empty state. Chip de estado con **fallback seguro** + marca "Vencido" cuando aplica.
- **Builder `nueva` / `[id]/editar`** (`quote-builder.tsx`, espeja `sale-builder` **sin pago**): selector de cliente (Consumidor final = null) + sucursal (solo back-office; fijo para operativos) + editor de líneas (añadir producto con prefill, cantidad/precio/desc%/tasa%, quitar) + descuento global % + **fecha "válido hasta"** + notas; panel de totales en vivo con `computeSaleTotals`. Botones: "Guardar borrador" (`save`) y **"Enviar"** (`send`; asigna número, pasa a `sent`). Errores Zod en línea.
- **Detalle `/[id]`** (`quote-document.tsx` espeja `sale-document`): vista documento (Nº o "BORRADOR", cliente/sucursal, líneas, totales, vigencia). Acciones por estado y rol (`canSell`):
  - `draft`: Editar · Enviar · Eliminar.
  - `sent`: Marcar Aceptado / Marcar Rechazado · **Convertir en venta**.
  - `accepted`: **Convertir en venta** · Marcar Rechazado.
  - `converted`: solo lectura + enlace a la venta (`/operaciones/facturacion/[converted_sale_id]`).
  - `rejected`: solo lectura.
- **Componentes** `src/components/presupuestos/`: `quotes-table.tsx`, `quote-row-card.tsx`, `quotes-toolbar.tsx`, `quote-status-badge.tsx`, `quote-builder.tsx`, `quote-document.tsx`.
- **Nav:** sin cambios (el item "Presupuestos" ya existe).
- **Dashboard:** sin cambios (no hay KPI de presupuestos en el diseño).

## Testing

- **Unit:** `schema.test.ts` (`quoteSendSchema` exige ≥1 línea; `validUntil` opcional acepta fecha o vacío; `quoteStatusSchema` valida accepted/rejected). (Totales y permisos reusan los tests de Ventas.)
- **Integración (Supabase local + RLS, serial, patrón Plan 1):**
  - Crear borrador → **Enviar** asigna correlativo propio; dos envíos → números consecutivos; la serie es **independiente** de la de ventas (emitir una venta no afecta el número del presupuesto y viceversa).
  - `setQuoteStatus`: `sent → accepted`/`rejected`.
  - **Convertir:** desde `sent`/`accepted` crea un `sales` con `status='draft'` y las mismas líneas (cantidades/precios), marca el presupuesto `converted` con `converted_sale_id`; la venta creada **sigue `draft`** (sin número, sin stock descontado, sin cobro). **No** se puede convertir dos veces (segundo intento falla).
  - Scoping por sucursal: un vendedor de otra sucursal no ve el presupuesto; back-office sí. Aislamiento entre tenants. `almacen` no puede insertar `quotes` (RLS niega).
  - Borrar un borrador elimina sus `quote_items` (cascade).
- **E2E manual:** crear presupuesto (cliente + líneas + descuentos + válido hasta), guardar borrador, editar, enviar (número), aceptar/rechazar, convertir → cae en el editor de la venta borrador con las líneas copiadas → emitir la venta; ver el presupuesto como "Convertido" con enlace a la venta; vencido (válido hasta en el pasado); role-gating (almacén sin acceso a crear; vendedor de otra sucursal no ve el presupuesto).
- **Regresión:** suite existente verde + `npm run build` limpio.

## Fuera de alcance (planes posteriores)

PDF / envío por email del presupuesto; plantillas de cotización; conversión parcial (elegir qué líneas convertir); versiones/revisiones de un presupuesto; vencimiento automático por cron (hoy es derivado en la lectura); presupuestos en el detalle de cliente; multi-moneda con tasa; numeración con prefijo configurable.
