# Kontify — Cobros / Cuentas por Cobrar (Plan 6): Diseño

> Spec de diseño. Cuarto módulo operativo, sobre Fundación (Plan 1), shell (Plan 2), Clientes (Plan 3), Productos (Plan 4) y Facturación/núcleo de ventas (Plan 5), todos en `master`.
> Fuente de verdad visual: `docs/design/design-system.md`. Espeja el patrón de Clientes/Productos/Ventas. Decisiones acordadas en brainstorming 2026-07-26.

## Objetivo

Registrar cobros (abonos totales o parciales) contra ventas emitidas a crédito; anularlos; y una pantalla **Cuentas por Cobrar** (Finanzas) organizada por cliente con aging (vencido / por vencer). Cierra el ciclo venta→cobro que Facturación dejó preparado (`sales.paid_amount`, saldo = `total − paid_amount`). Reemplaza el placeholder de `/finanzas/cuentas-por-cobrar` y enriquece el detalle de venta con historial de cobros y registro de abonos.

## Contexto y punto de partida

- **Plan 5 (`master`):** ventas (`sales`, `sale_items`) con estados `draft/issued/void`, `paid_amount`, `payment_method`, correlativo por empresa (RPC `next_sale_number`), RLS con scoping por sucursal, helper `current_user_branch_id()`. `emitSale` hoy setea `paid_amount = total` para contado y `0` para crédito. `voidSale` pasa a `void`. Queries `receivablesTotal`, `salesByClient`, `listSales` (con filtro "pendientes" = `paid_amount=0`, marcado en el código para cambiar cuando existan abonos). Función pura `computeSaleTotals`. Server Actions con patrón `ctx()`/`FormState`/`zodErrors`. Builder con emisión inline (contado/crédito).
- **Plan 1:** `current_tenant_id()`/`current_user_role()` SECURITY DEFINER; GRANTs de tabla a `authenticated` obligatorios. Tests de integración serial contra Supabase local.
- **Roles y recursos:** `finanzas` (recurso) accesible a owner/admin/administrativo (`canAccess`); vendedor→operaciones/clientes; cajero→caja/operaciones; almacen→operaciones. La pantalla Cuentas por Cobrar vive bajo `finanzas` → visible a back-office.
- **No existe todavía:** tabla de cobros, fecha de vencimiento de ventas, ni recálculo automático de `paid_amount`.

## Decisiones de alcance (acordadas)

1. **Cada peso pagado es una fila en `payments`** (incluido el contado, que ahora crea un cobro al emitir). `sales.paid_amount` se vuelve **derivado** vía trigger = Σ de cobros no anulados. Da historial de cobros consistente y saldo siempre correcto.
2. **Fecha de vencimiento opcional** (`sales.due_date`), se fija al emitir a crédito; editable luego por back-office. Habilita aging (Vencido / Por vencer).
3. **Abonos parciales** permitidos; se valida `monto ≤ saldo`.
4. **Anulación de cobros** (soft, `voided`) por owner/admin; el trigger restaura el saldo.
5. **Permisos:** registrar abono manual → owner/admin/administrativo (back-office). Ver Cuentas por Cobrar → back-office. Anular cobro → owner/admin. Editar vencimiento → back-office. **Cajero/vendedor NO registran abonos manuales.**
6. **RLS laxo + barrera en la acción:** `payments` SELECT/INSERT permitido a los 5 roles de venta a nivel RLS (tenant-scoped) para que el **contado** siga funcionando (lo emiten vendedor/cajero); la restricción "solo back-office registra abonos manuales" se refuerza en la Server Action (`canRegisterPayment`) y en que la pantalla de Cobros es de Finanzas. Anular cobro (`voided`) sí se restringe en RLS a owner/admin.
7. **`voidSale` se bloquea si la venta tiene cobros activos** (hay que anular los cobros primero).
8. **CxC por cliente** con drill-down al estado de cuenta (ventas pendientes del cliente).
9. **Arquitectura:** capa testeable `src/lib/cobros/*` + Server Actions + trigger de BD. Espeja el patrón de los módulos previos. No fiscal, moneda única del tenant.

## Modelo de datos

### `payments`
```
id            uuid pk default gen_random_uuid()
tenant_id     uuid not null → tenants(id) on delete cascade    -- denormalizado para RLS
sale_id       uuid not null → sales(id) on delete cascade
amount        numeric(14,2) not null                           -- > 0, ≤ saldo al registrar
method        text                                             -- efectivo/transferencia/… (texto libre)
reference     text                                             -- nº comprobante/referencia (opcional)
paid_at       date not null default current_date               -- fecha del cobro (editable, default hoy)
voided        boolean not null default false                   -- anulación (soft)
notes         text
created_by    uuid → auth.users(id) on delete set null
created_at    timestamptz not null default now()
índices: (tenant_id), (sale_id)
```

### `sales.due_date` y `sales.balance` (nuevas columnas)
```
alter table public.sales add column due_date date;   -- vencimiento, nullable; se fija al emitir a crédito
-- saldo derivado, filtrable/indexable (PostgREST no compara columna-a-columna):
alter table public.sales add column balance numeric(14,2)
  generated always as (total - paid_amount) stored;
create index sales_tenant_balance on public.sales (tenant_id, balance);
```
`paid_amount` lo mueve el trigger de `payments`; `balance` (stored generated) se recalcula solo cuando cambia `paid_amount`. Las queries de Cuentas por Cobrar y el filtro "pendientes" de `listSales` filtran `balance > 0`.

### `paid_amount` derivado — función + trigger
`sales.paid_amount` deja de escribirse a mano; lo mantiene el trigger:
```sql
create or replace function public.recompute_sale_paid_amount()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_sale uuid;
begin
  v_sale := coalesce(new.sale_id, old.sale_id);
  update public.sales s
    set paid_amount = coalesce((
      select sum(p.amount) from public.payments p
      where p.sale_id = v_sale and p.voided = false
    ), 0),
    updated_at = now()
  where s.id = v_sale;
  return null;
end; $$;

create trigger trg_recompute_paid_amount
  after insert or update or delete on public.payments
  for each row execute function public.recompute_sale_paid_amount();
```
(SECURITY DEFINER → actualiza `sales` saltándose RLS, así el back-office que registra un cobro no necesita UPDATE directo sobre `sales`.)

### Estados derivados (no columnas)
- `saldo = total − paid_amount`.
- Pago: **pagada** (`saldo ≤ 0`) / **parcial** (`0 < paid_amount < total`) / **pendiente** (`paid_amount = 0`).
- **Vencido** = `due_date is not null AND due_date < current_date AND saldo > 0`.

### RLS y GRANTs
- `payments` **enable RLS**:
  - **SELECT / INSERT:** `tenant_id = current_tenant_id() AND current_user_role() in ('owner','admin','administrativo','vendedor','cajero')` (laxo: permite que el contado, emitido por vendedor/cajero, cree su cobro; y que el detalle de venta muestre cobros a quien ve la venta).
  - **UPDATE** (solo para anular, `voided`): `... AND current_user_role() in ('owner','admin')`.
  - Sin DELETE. GRANTs a `authenticated`: `select, insert, update`.
- **Barrera de abonos manuales:** la Server Action `registerPaymentAction` exige `canRegisterPayment` (back-office); la pantalla de Cobros es `finanzas`. Un vendedor/cajero puede crear el cobro del contado (vía `emitSale`) pero no registra abonos manuales por la app.
- `sales.due_date`: se actualiza vía Server Action con rol back-office; la política `sales_update` existente (Plan 5) ya permite a back-office actualizar la venta — sin cambios de RLS.

Migraciones nuevas (forward-only): `0016_payments_schema.sql` (tabla `payments` + `sales.due_date` + `sales.balance` generado + índices), `0017_payments_rls.sql` (policies + grants), `0018_paid_amount_trigger.sql` (función + trigger).

## Cambios en Facturación (Plan 5)

Contenidos en este plan (con sus tests de regresión):
1. **`emitSale` (mutación):** el contado deja de setear `paid_amount`; ahora **inserta un `payment`** por el total (`method` = método elegido, `paid_at` = hoy). El crédito no crea payment. El trigger fija `paid_amount`. El campo `sales.payment_method` se sigue guardando para el "a simple vista", pero la fuente de verdad de los cobros es `payments`.
2. **`emitSale` acepta `dueDate` opcional** (solo crédito) y lo guarda en `sales.due_date`.
3. **`voidSale`:** rechaza si existe algún `payment` activo de la venta (mensaje "Anula primero los cobros").
4. **`listSales` filtro "pendientes":** pasa de `paid_amount = 0` a **saldo > 0**. Como PostgREST no permite comparar dos columnas (`paid_amount < total`), se apoya en la columna generada `balance` (ver Modelo de datos) y filtra `.gt("balance", 0)`. Igual se usa `balance > 0` en las queries de Cuentas por Cobrar.
5. **Builder / emit-dialog:** cuando el pago es Crédito, campo opcional **Fecha de vencimiento** que viaja a `emitSaleAction` → `emitSale`.

## Capa de servidor (`src/lib/cobros/*`)

- **`permissions.ts`** — puras: `canRegisterPayment(role)` → owner/admin/administrativo; `canVoidPayment(role)` → owner/admin; `canEditDueDate(role)` → owner/admin/administrativo.
- **`schema.ts`** — Zod: `paymentCreateSchema` (`saleId` uuid/guid, `amount` `>0`, `method` opcional, `reference` opcional, `paidAt` fecha ≤ hoy opcional (default hoy), `notes` opcional); `dueDateSchema` (`saleId`, `dueDate` date|null).
- **`queries.ts`** (RLS-scoped, degradación segura → vacíos/ceros):
  - `listReceivablesByClient(sb, {search, filter})` → `[{ clientId, name, totalDue, overdueAmount, oldestDueDate }]` de clientes con `balance>0`; `filter` ∈ `todos|vencidos`.
  - `getClientReceivable(sb, clientId)` → `{ client, rows: [{ saleId, number, total, paid, balance, dueDate, overdue }], totalDue, overdueAmount }`.
  - `listPayments(sb, saleId)` → cobros de una venta `[{ id, amount, method, reference, paidAt, voided }]` (incluye anulados marcados).
  - `receivablesKpi(sb)` → `{ total, overdue }` (extiende `receivablesTotal` con la porción vencida).
- **`mutations.ts`**:
  - `registerPayment(sb, tenantId, userId, input)` → lee la venta (status issued + `balance`), valida `amount ≤ balance` (si no, lanza), inserta `payment`; el trigger actualiza `paid_amount`/`balance`. Devuelve el id.
  - `voidPayment(sb, id)` → `update ... set voided=true ... .eq('voided', false)` (idempotente; lanza si 0 filas); el trigger recalcula.
  - `setDueDate(sb, saleId, dueDate)` → actualiza `sales.due_date` solo si `status='issued'`.
- **Server Actions `src/app/(app)/finanzas/cuentas-por-cobrar/actions.ts`** (`"use server"`, patrón `ctx()`):
  - `registerPaymentAction` — Zod + `canRegisterPayment`; `revalidatePath` de CxC, detalle de venta, `/dashboard` y `/clientes/[clientId]`.
  - `voidPaymentAction` — `canVoidPayment`.
  - `setDueDateAction` — `canEditDueDate`.
- **Cambios en `src/lib/ventas/mutations.ts` y `.../facturacion/actions.ts`:** `emitSale` (contado crea payment + due_date), `voidSale` (bloqueo por cobros activos), y `listSales` (filtro `balance>0`). El `emitSaleAction`/builder pasan `dueDate`.

**Flujo de un abono:** CxC o detalle de venta → panel `payment-form` → `registerPaymentAction` → Zod → `canRegisterPayment` → `registerPayment` (valida `amount ≤ balance`) → insert `payment` → trigger recalcula `paid_amount`/`balance` → `revalidatePath`.

## UI

Lenguaje visual Plan 2. Reusa `formatMoney`, `getTenantCurrency`, `EmptyState`.

- **`/finanzas/cuentas-por-cobrar` (por cliente)** — server component; `listReceivablesByClient` desde `searchParams` (q, filter). Toolbar: buscador (cliente) + filtro (Todos / Vencidos). Tabla escritorio (Cliente · Total adeudado · Vencido · Vto. más antiguo) / cards móvil; fila → `[clientId]`. Encabezado con total por cobrar + vencido. Empty state "Sin saldos pendientes".
- **`/finanzas/cuentas-por-cobrar/[clientId]` (estado de cuenta)** — ventas pendientes del cliente (Nº · total · pagado · **saldo** · vencimiento · chip Vencido) con total adeudado; por cada venta, **"Registrar abono"** (panel inline `payment-form` → `registerPaymentAction`). Redirige a `/dashboard` si el rol no es back-office.
- **Detalle de venta (`/operaciones/facturacion/[id]`) — enriquecido:**
  - Sección **Cobros** (`payments-history`): monto/método/fecha/referencia; **Anular** por cobro (owner/admin) → `voidPaymentAction`; los anulados se muestran tachados.
  - Botón **"Registrar abono"** si `status='issued'`, `balance>0` y `canRegisterPayment` → panel `payment-form`.
  - **Vencimiento** (`due-date-field`): muestra `due_date` + editar (back-office) → `setDueDateAction`; chip *Vencido* si aplica.
  - Estado de pago: *Pagada / Parcial / Pendiente* (derivado del saldo).
- **Builder / emit-dialog (Facturación):** con pago **Crédito**, campo opcional **Fecha de vencimiento** → `emitSaleAction`.
- **`payment-form.tsx`** (panel inline, PWA-safe, no diálogo nativo): monto (default = saldo), método, referencia, fecha (default hoy), notas; valida `monto ≤ saldo` en cliente y servidor; errores Zod en línea.

**Componentes** `src/components/cobros/`: `receivables-table.tsx`, `receivable-row-card.tsx`, `receivables-toolbar.tsx`, `payment-form.tsx`, `payments-history.tsx`, `due-date-field.tsx`. Los botones/paneles de escritura se ocultan según rol (barrera dura = RLS + Server Action).

## Dashboard

"Por cobrar" ya es real (Plan 5) — sin cambios en este plan. (Opcional a futuro, fuera de alcance: alimentar "Requieren atención" con ventas vencidas usando `receivablesKpi.overdue`.)

## Testing

- **Unit:** `permissions.test.ts` (`canRegisterPayment` = owner/admin/administrativo, NO vendedor/cajero; `canVoidPayment` = owner/admin); `schema.test.ts` (`amount>0`, `paidAt ≤ hoy`, `saleId` requerido).
- **Integración (Supabase local + RLS + trigger, serial, patrón Plan 1):**
  - Emitir **contado crea una fila `payment`** y la venta queda pagada (`balance = 0`).
  - `registerPayment` parcial → `balance` baja y estado *parcial*; segundo abono que completa → *pagada* (`balance 0`). El trigger mantiene `paid_amount`/`balance`.
  - `amount > balance` es rechazado por la mutación.
  - `voidPayment` restaura el `balance` (trigger recalcula).
  - **`voidSale` bloqueado** si la venta tiene cobros activos; permitido tras anular el cobro.
  - `listReceivablesByClient` agrupa por cliente y calcula `overdueAmount` con una venta `due_date` en el pasado; `filter='vencidos'` filtra bien.
  - Aislamiento entre tenants; RLS: owner/admin/administrativo leen/insertan payments; anular solo owner/admin.
  - Regresión de Facturación: `listSales` "pendientes" ahora usa `balance>0` (una venta con abono parcial sigue apareciendo como pendiente).
- **E2E manual:** CxC por cliente con vencidos; estado de cuenta; registrar abono parcial y total desde CxC y desde el detalle de venta; anular un cobro (owner) y ver subir el saldo; fijar/editar vencimiento; emitir a crédito con vencimiento; intentar anular una venta con cobros (bloqueado); role-gating (vendedor/cajero sin acceso a CxC ni a "Registrar abono"; sí pueden emitir contado).
- **Regresión:** suite existente verde + `npm run build` limpio.

## Fuera de alcance (planes posteriores)

Notas de crédito / devoluciones; recibos/estado de cuenta en PDF; catálogo configurable de métodos de pago; límite de crédito y condiciones de pago automáticas (términos que calculan `due_date`); multi-moneda con tasa; Cuentas por **pagar** a proveedores, comisiones, bancos, gastos (otros módulos de Finanzas); alimentar "Requieren atención" del dashboard con vencidas.
