# Kontify — Módulo Productos (Plan 4): Diseño

> Spec de diseño. Segundo módulo operativo, sobre el motor multi-tenant (Plan 1), el shell visual (Plan 2) y el módulo Clientes (Plan 3), todos en `master`.
> Fuente de verdad visual: `docs/design/design-system.md`. Espeja el patrón de Clientes. Decisiones acordadas en brainstorming 2026-07-24.

## Objetivo

Catálogo de productos por empresa: crear, listar (con búsqueda/filtros), ver, editar y archivar productos, con **categorías** y **tasas de impuesto** configurables por negocio; y alimentar el KPI "Productos" y el widget "Productos por categoría" del dashboard con datos reales. Reemplaza el placeholder de `/operaciones/productos`. **Sin control de stock/inventario** — eso llega en un plan posterior (movimientos, compras, ventas); este módulo deja la base limpia sobre la que Facturación/Inventario operarán.

## Contexto y punto de partida

- **Plan 1 (en `master`):** tenancy con RLS. `canAccess(role, resource)` en `src/lib/auth/roles.ts` (roles: owner, admin, administrativo, vendedor, cajero, almacen; recursos: billing, finanzas, caja, operaciones, reportes, clientes). RPC `bootstrap_tenant` crea tenant + sucursal + owner. `current_tenant_id()`/`current_user_role()` SECURITY DEFINER. Patrón de tests de integración contra Supabase local (serial, RLS) en `tests/`.
- **Plan 2 (en `master`):** shell + dashboard con componentes presentacionales (`KpiCard`, `ChartCard`, `AttentionList`) que reciben datos por props y muestran empty states. `src/lib/nav.ts` = IA gateada por rol; `CONFIG_SECTION` extensible. El item de nav **"Productos" ya existe** apuntando a `/operaciones/productos` (icono `Package`), gateado por el recurso `operaciones`. Server Actions + Zod es el patrón de mutaciones (regla del usuario: Zod por endpoint, RLS, nada sensible/lógica en el front).
- **Plan 3 (en `master`):** módulo Clientes — plantilla directa de este plan. Reproduce su arquitectura: enum + tabla configurable por tenant (`client_types`) + tabla principal (`clients`) con RLS por rol, capa `src/lib/clientes/*` (schema/permissions/queries/mutations) testeable, Server Actions en `src/app/(app)/clientes/actions.ts`, UI con tabla/cards/toolbar/badge, pantalla de gestión en Configuración, y KPI + widget de dashboard con degradación segura. Migraciones `0006`–`0008`.
- **No existe todavía:** ningún catálogo de productos ni moneda a nivel tenant. Sin ventas/compras → no hay stock, movimientos ni valorización de inventario (fuera de alcance).

## Decisiones de alcance (acordadas)

1. **Solo catálogo, sin stock.** El módulo gestiona la ficha del producto; las existencias y movimientos llegan en un plan posterior. El detalle muestra "Existencias/Movimientos" como empty state ("llega con Inventario").
2. **Precio único + costo.** Cada producto tiene `price` (venta) y `cost` opcional (para margen futuro). Listas de precios por tipo de cliente se difieren.
3. **Impuesto: tasas configurables por empresa.** Tabla `tax_rates` por tenant (patrón `client_types`), sembrada con "IVA 16%" (default) y "Exento 0%". Cada producto referencia una tasa. Facturación la usará para calcular totales.
4. **Categorías configurables por empresa.** Tabla `product_categories` por tenant (patrón `client_types`), sembrada con "General". Alimenta filtro de lista y widget de dashboard "Productos por categoría".
5. **Campos estándar** por producto: nombre, tipo (bien/servicio), SKU/código interno (opcional, único por empresa), descripción (opcional), unidad de medida (texto, default "unidad"), categoría, precio, costo (opcional), tasa de impuesto, activo/inactivo. (Código de barras, variantes e imágenes se difieren.)
6. **Tipo bien vs servicio.** Enum `product_kind` (`good`/`service`) para preparar el terreno: los servicios nunca llevarán stock; los bienes sí cuando llegue Inventario.
7. **Moneda: una por empresa.** Nueva columna `tenants.currency` (default `USD`); `price`/`cost` son decimales en esa moneda. Helper `formatMoney` para presentación. Sin conversión ni tasa (eso es de Facturación si hiciera falta).
8. **Productos a nivel empresa (compartidos).** Todas las sucursales ven el mismo catálogo; se guarda de forma informativa en qué sucursal se registró. El selector de sucursal del top bar no filtra la lista.
9. **Permisos:** owner/admin/administrativo/almacen → CRUD (crear/editar). Archivar (soft-delete) solo owner/admin. vendedor/cajero → **solo lectura** (ven el catálogo, sin botones de escritura). Gestión de categorías y tasas → solo owner/admin. Sin borrado en duro.
10. **Arquitectura:** Server Actions + capa de datos testeable (`src/lib/productos/*`). Lecturas por server components (RLS-scoped). Validación Zod en el servidor. Espeja Clientes.

## Modelo de datos

Enums nuevos:
```
create type public.product_kind as enum ('good','service');
```

### `product_categories`
```
id            uuid pk default gen_random_uuid()
tenant_id     uuid not null → tenants(id) on delete cascade
name          text not null
active        boolean not null default true
created_at    timestamptz not null default now()
unique (tenant_id, lower(name))   -- vía índice único funcional
índice: (tenant_id)
```
Siembra: `bootstrap_tenant` (modificado en migración forward) inserta "General" para el tenant nuevo. Tenants preexistentes la obtienen creando al vuelo o desde la gestión.

### `tax_rates`
```
id            uuid pk default gen_random_uuid()
tenant_id     uuid not null → tenants(id) on delete cascade
name          text not null                          -- "IVA 16%", "Exento 0%"
rate          numeric(5,2) not null default 0        -- porcentaje: 16.00, 0.00
is_default    boolean not null default false
active        boolean not null default true
created_at    timestamptz not null default now()
unique (tenant_id, lower(name))   -- vía índice único funcional
índice: (tenant_id)
```
Siembra (`bootstrap_tenant`): "IVA 16%" (rate 16, `is_default = true`) y "Exento 0%" (rate 0). Invariante de a-lo-sumo-un-default por tenant: se refuerza en la capa de mutación/Server Action al marcar default (desmarca los demás); no se añade índice parcial por simplicidad, pero la lógica de `updateTaxRate`/`createTaxRate` garantiza unicidad.

### `products`
```
id                uuid pk default gen_random_uuid()
tenant_id         uuid not null → tenants(id) on delete cascade
kind              public.product_kind not null           -- good/service
name              text not null
sku               text                                   -- código interno, opcional
description       text
category_id       uuid → product_categories(id) on delete set null
price             numeric(14,2) not null default 0       -- venta, moneda del tenant
cost              numeric(14,2)                           -- costo opcional (margen)
tax_rate_id       uuid → tax_rates(id) on delete set null
unit              text not null default 'unidad'         -- unidad de medida
active            boolean not null default true          -- soft-delete / archivar
created_branch_id uuid → branches(id) on delete set null -- informativo
created_by        uuid → auth.users(id) on delete set null
created_at        timestamptz not null default now()
updated_at        timestamptz not null default now()
índices: (tenant_id), (tenant_id, active), (tenant_id, category_id)
índice único parcial: unique (tenant_id, lower(sku)) where sku is not null  -- SKU único por empresa cuando existe
```
Búsqueda: `ILIKE` sobre name/sku con filtro de tenant. Índice trigram: fuera de alcance.

### `tenants.currency`
```
alter table tenants add column currency text not null default 'USD';
```
Una moneda por empresa; editar la moneda es fuera de alcance de este plan (se usa el default; se podrá exponer en Configuración más adelante).

### RLS y GRANTs
La barrera real de autorización es RLS; el menú solo oculta. Rol vía `current_user_role()`.

- `products` **enable RLS**:
  - **SELECT:** `tenant_id = current_tenant_id()` (cualquiera de los 6 roles del tenant) — el catálogo es visible en lectura para vendedor/cajero además de los roles CRUD.
  - **INSERT / UPDATE:** `tenant_id = current_tenant_id() AND current_user_role() IN ('owner','admin','administrativo','almacen')`.
  - Sin política DELETE (nadie borra en duro).
- `product_categories` y `tax_rates` **enable RLS**:
  - **SELECT:** `tenant_id = current_tenant_id()` (todos los roles del tenant, para mostrar chips/opciones).
  - **INSERT** (crear al vuelo): `... AND current_user_role() IN ('owner','admin','administrativo','almacen')`.
  - **UPDATE** (renombrar/desactivar/marcar default): `... AND current_user_role() IN ('owner','admin')`.
- La regla "solo owner/admin archiva productos" (poner `active=false`) se refuerza en la **Server Action** (`canArchiveProduct(role)`), porque RLS no restringe bien por columna; RLS igual garantiza aislamiento de tenant y gate de escritura por rol.
- GRANTs a `authenticated`: `select, insert, update` en `products`, `product_categories` y `tax_rates` (no delete).

Migraciones nuevas (forward-only, continúan la numeración): `0009_products_schema.sql` (enum + tablas + índices + `tenants.currency`), `0010_products_rls.sql` (policies + grants), `0011_seed_product_defaults.sql` (reemplaza `bootstrap_tenant` para sembrar "General", "IVA 16%" default y "Exento 0%").

## Capa de servidor (`src/lib/productos/*`)

- **`schema.ts`** — Zod:
  - `productCreateSchema` (kind ∈ {good,service}; name 1–120 no vacío; sku 1–40 opcional; description opcional; unit 1–20 default "unidad"; category_id uuid|null; price ≥ 0 con 2 decimales; cost ≥ 0 opcional; tax_rate_id uuid|null).
  - `productUpdateSchema` (todos opcionales salvo consistencia).
  - `categoryCreateSchema` (name 1–40), `categoryUpdateSchema` (name?, active?).
  - `taxRateCreateSchema` (name 1–40, rate 0–100, is_default?), `taxRateUpdateSchema` (name?, rate?, is_default?, active?).
  - Tipos con `z.infer`.
- **`permissions.ts`** — puros:
  - `canManageProducts(role)` → `role ∈ {owner,admin,administrativo,almacen}` (crear/editar).
  - `canArchiveProduct(role)` → `role === 'owner' || role === 'admin'`.
  - `canManageCategories(role)` / `canManageTaxRates(role)` → `role === 'owner' || role === 'admin'`.
- **`queries.ts`** — reciben un cliente Supabase (RLS-scoped):
  - `listProducts(sb, {search, categoryId, kind, status, page, pageSize})` (paginado server-side; status ∈ activos|archivados|todos; kind opcional).
  - `getProduct(sb, id)` (con nombre de categoría y tasa resueltos).
  - `listCategories(sb, {includeInactive})`, `listTaxRates(sb, {includeInactive})`.
  - `productsKpi(sb)` → `{ total }` (productos activos).
  - `productsByCategory(sb)` → `[{ categoryId, name, count }]`.
  - **Degradación segura:** `productsKpi`/`productsByCategory` los consume el dashboard, que también ven roles sin foco en catálogo. Ante error/permission-denied de RLS deben devolver valores vacíos (`{ total: 0 }` / `[]`) — nunca lanzar — para que el dashboard muestre el empty state en vez de crashear.
- **`mutations.ts`** — reciben Supabase (confían en RLS): `createProduct`, `updateProduct`, `archiveProduct(sb, id, active)`, `createCategory`, `updateCategory`, `createTaxRate`, `updateTaxRate`. Al crear/actualizar una tasa con `is_default = true`, desmarca las demás del tenant (mantiene a-lo-sumo-un-default).
- **`src/app/(app)/operaciones/productos/actions.ts`** — `"use server"`: obtienen cliente Supabase server + rol (de `memberships`), **validan con Zod**, **aplican la regla de rol** (crear/editar exigen `canManageProducts`; archivar exige `canArchiveProduct`; categorías/tasas exigen `canManageCategories`/`canManageTaxRates`), llaman a la capa de datos, `revalidatePath`. Devuelven `{ ok: boolean, error?: string, fieldErrors?: Record<string,string> }`.

**Flujo de escritura:** form → Server Action → Zod → chequeo de rol → `mutations.*` → Supabase (RLS) → `revalidatePath`.

**Formato de moneda:** helper `src/lib/format.ts` → `formatMoney(amount, currency)` (usa `Intl.NumberFormat`). El server component lee `tenants.currency` una vez y lo pasa a la UI.

## UI

Lenguaje visual del Plan 2 (tokens Teal & Slate, Radix, `EmptyState`). Ruta base ya cableada en el nav: `/operaciones/productos`.

- **`/operaciones/productos` (lista)** — server component; lee `listProducts` desde `searchParams` (search, categoría, tipo, estado, página). Tabla en escritorio (Nombre · SKU · Categoría(chip) · Precio · Estado), cards en móvil; fila cliqueable → detalle; paginación server-side. Toolbar: buscador (name/SKU) + filtro por categoría + filtro por tipo (Bien/Servicio) + filtro estado (Activos/Archivados/Todos). Header con "Nuevo producto" (oculto para vendedor/cajero). Empty state "Aún no tienes productos" + CTA.
- **`/operaciones/productos/nuevo` (crear)** — form (client) con Server Action `createProduct`; set de campos estándar; selector de categoría con **"crear categoría al vuelo"** (usa `createCategory`) y selector de tasa de impuesto (con la default preseleccionada); errores de Zod en línea. Al crear → redirect a `/operaciones/productos/[id]`.
- **`/operaciones/productos/[id]` (detalle)** — datos del producto (precio/costo/margen si hay costo, tasa, unidad, categoría) + acciones **Editar** (roles CRUD) y **Archivar/Reactivar** (solo owner/admin). Sección "Existencias / Movimientos" como **empty state** ("llega con Inventario"). Chip si está archivado.
- **`/operaciones/productos/[id]/editar`** — reusa el form component con `updateProduct`.
- **Configuración (owner/admin):**
  - **`/configuracion/categorias-de-producto`** — lista de categorías + crear/renombrar/desactivar (Server Actions).
  - **`/configuracion/tasas-de-impuesto`** — lista de tasas + crear/renombrar/editar rate/marcar default/desactivar (Server Actions).
  - Nuevos children en `CONFIG_SECTION` de `nav.ts`, con `resource: "billing"` (gate owner/admin, como "Tipos de cliente").

**Componentes** en `src/components/productos/`: `product-form.tsx` (compartido crear/editar, con selector de categoría + crear-al-vuelo y selector de tasa), `products-table.tsx`, `product-row-card.tsx` (móvil), `products-toolbar.tsx` (buscador+filtros, actualiza la URL), `category-badge.tsx`. Reusa `EmptyState`. Los botones de escritura se ocultan según rol (la barrera dura es RLS + Server Action).

## Dashboard

- **KPI "Productos"** (escritorio y móvil): el dashboard llama a `productsKpi(sb)` y pasa `value` (total activos) a la `KpiCard` existente; si no hay productos, se mantiene el empty state.
- **Widget "Productos por categoría"** (solo escritorio, per design-system §7 — no en inicio móvil): nuevo widget alimentado por `productsByCategory(sb)`, en el grid del dashboard de escritorio, con empty state propio.
- Acoplamiento limpio: el dashboard importa desde `src/lib/productos/queries.ts`; la lógica vive en el módulo.

## Testing

- **Unit:** `permissions.test.ts` (`canManageProducts` incluye almacen pero no vendedor/cajero; `canArchiveProduct`/`canManageCategories`/`canManageTaxRates` solo owner/admin); `schema.test.ts` (Zod exige name/kind, rechaza price negativo, rate fuera de 0–100).
- **Integración (Supabase local + RLS, serial, patrón Plan 1):**
  - Aislamiento: tenant A no ve productos de B.
  - Gateo por rol: `cajero`/`vendedor` pueden **leer** productos (RLS SELECT) pero NO insertar (RLS INSERT niega); `almacen` puede crear/editar productos pero NO renombrar una categoría ni gestionar tasas (RLS UPDATE en `product_categories`/`tax_rates` niega).
  - `createProduct`/`updateProduct`/`archiveProduct` (active=false) OK; SKU duplicado por tenant es rechazado por el índice único parcial.
  - `productsKpi`/`productsByCategory` devuelven conteos correctos.
  - Marcar una tasa como default desmarca las demás del tenant (a-lo-sumo-un-default).
  - Siembra: un tenant nuevo (vía `bootstrap_tenant`) tiene "General", "IVA 16%" (default) y "Exento 0%".
- **E2E manual:** lista con búsqueda/filtros/paginación; crear con "crear categoría al vuelo" y tasa; detalle (margen con costo); editar; archivar/reactivar; pantallas de categorías y tasas (owner); dashboard con KPI + widget reales; role-gating (vendedor/cajero sin botones de escritura pero ven el catálogo; almacen sin acceso a las pantallas de Configuración).
- **Regresión:** suite existente verde + `npm run build` limpio.

## Fuera de alcance (planes posteriores)

Control de stock/inventario y movimientos (entradas/salidas/ajustes, historial); valorización de inventario; código de barras; listas de precios configurables por tipo de cliente; variantes de producto; imágenes/fotos; import/export y de-duplicación; multi-moneda con tasa de cambio; edición de la moneda del tenant en Configuración; índice trigram de búsqueda; renombrar/desactivar categorías con reasignación masiva.
