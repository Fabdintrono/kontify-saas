# Kontify — Módulo Clientes (Plan 3): Diseño

> Spec de diseño. Primer módulo operativo, sobre el motor multi-tenant (Plan 1) y el shell visual (Plan 2), ambos en `master`.
> Fuente de verdad visual: `docs/design/design-system.md`. Decisiones acordadas en brainstorming 2026-07-19.

## Objetivo

Gestión de clientes por empresa: crear, listar (con búsqueda/filtros), ver, editar y archivar clientes, con "tipos de cliente" configurables por negocio; y alimentar el KPI "Total de clientes" y el widget "Clientes por tipo" del dashboard con datos reales. Reemplaza los placeholders de `/clientes` y `/clientes/nuevo`.

## Contexto y punto de partida

- **Plan 1 (en `master`):** tenancy con RLS. Helpers `canAccess(role, resource)` en `src/lib/auth/roles.ts` (roles: owner, admin, administrativo, vendedor, cajero, almacen). RPC `bootstrap_tenant` crea tenant + sucursal + owner. `current_tenant_id()`/`current_user_role()` SECURITY DEFINER. Patrón de tests de integración contra Supabase local (serial, RLS) en `tests/`.
- **Plan 2 (en `master`):** shell + dashboard con componentes presentacionales (`KpiCard`, `ChartCard`, `AttentionList`) que reciben datos por props y muestran empty states. `src/lib/nav.ts` = IA gateada por rol; `CONFIG_SECTION` extensible. Server Actions + Zod es el patrón elegido para mutaciones (regla del usuario: Zod por endpoint, RLS, nada sensible/lógica en el front).
- **No existe todavía:** ningún módulo operativo. Sin ventas/facturas → el historial de compras, "por cobrar" y los segmentos conductuales (Frecuentes/Nuevos) no se pueden calcular aún.

## Decisiones de alcance (acordadas)

1. **Campos estándar** por cliente: nombre/razón social, tipo persona/empresa, documento/ID opcional (NO fiscal), teléfono, email, dirección, tipo de cliente (segmento), persona de contacto (si empresa), notas, activo/inactivo. (Límite de crédito y condiciones de pago se difieren a Facturación.)
2. **Tipos de cliente configurables por empresa:** tabla `client_types` por tenant, sembrada con Minorista y Mayorista. El widget "Clientes por tipo" agrupa por estos. Los conductuales Frecuentes/Nuevos se derivan luego de ventas (fuera de alcance).
3. **Clientes a nivel empresa (compartidos):** todas las sucursales ven los mismos clientes; se guarda de forma informativa en qué sucursal se registró. El selector de sucursal del top bar no filtra la lista de clientes.
4. **Permisos:** owner/admin/administrativo → CRUD completo. vendedor → crear y editar, pero NO archivar. Archivar (soft-delete) solo owner/admin. cajero/almacen → sin acceso (menú + RLS). Sin borrado en duro.
5. **Gestión de tipos:** siembra por defecto + "crear tipo al vuelo" en el formulario de cliente (vendedor+) + pantalla de gestión dedicada (listar/renombrar/desactivar) en Configuración, gateada a owner/admin.
6. **Arquitectura:** Server Actions + capa de datos testeable (`src/lib/clientes/*`). Lecturas por server components (RLS-scoped). Validación Zod en el servidor.

## Modelo de datos

### `client_types`
```
id            uuid pk default gen_random_uuid()
tenant_id     uuid not null → tenants(id) on delete cascade
name          text not null
active        boolean not null default true
created_at    timestamptz not null default now()
unique (tenant_id, lower(name))   -- vía índice único funcional
índice: (tenant_id)
```
Siembra: `bootstrap_tenant` (modificado en migración forward) inserta "Minorista" y "Mayorista" para el tenant nuevo. Tenants preexistentes los obtienen creando al vuelo o desde la gestión.

### `clients`
```
id                uuid pk default gen_random_uuid()
tenant_id         uuid not null → tenants(id) on delete cascade
kind              public.client_kind not null           -- enum ('person','company')
name              text not null
doc_id            text                                   -- documento/ID, NO fiscal
email             text
phone             text
address           text
contact_name      text                                   -- persona de contacto (empresa)
type_id           uuid → client_types(id) on delete set null
notes             text
active            boolean not null default true          -- soft-delete / archivar
created_branch_id uuid → branches(id) on delete set null -- informativo
created_by        uuid → auth.users(id) on delete set null
created_at        timestamptz not null default now()
updated_at        timestamptz not null default now()
índices: (tenant_id), (tenant_id, active), (tenant_id, type_id)
```
Enum nuevo: `create type public.client_kind as enum ('person','company');`
Búsqueda: `ILIKE` sobre name/phone/email/doc_id con filtro de tenant. Índice trigram: fuera de alcance.

### RLS y GRANTs
La barrera real de autorización es RLS; el menú solo oculta. Rol vía `current_user_role()`.

- `client_types` **enable RLS**:
  - SELECT: `tenant_id = current_tenant_id() AND current_user_role() IN ('owner','admin','administrativo','vendedor')`
  - INSERT (crear al vuelo): with check igual que SELECT (los 4 roles).
  - UPDATE (renombrar/desactivar): `... AND current_user_role() IN ('owner','admin')`.
- `clients` **enable RLS**:
  - SELECT / INSERT / UPDATE: `tenant_id = current_tenant_id() AND current_user_role() IN ('owner','admin','administrativo','vendedor')`.
  - Sin política DELETE (nadie borra en duro).
- La regla "vendedor no archiva clientes" (poner `active=false`) se refuerza en la **Server Action** (`canArchiveClient(role)`), porque RLS no restringe bien por columna; RLS igual garantiza aislamiento de tenant y gate de escritura por rol.
- GRANTs a `authenticated`: `select, insert, update` en `clients` y `client_types` (no delete).

Migraciones nuevas (forward-only, continúan la numeración): `0006_clients_schema.sql` (enum + tablas + índices), `0007_clients_rls.sql` (policies + grants), `0008_seed_client_types_bootstrap.sql` (reemplaza `bootstrap_tenant` para sembrar los tipos por defecto).

## Capa de servidor (`src/lib/clientes/*`)

- **`schema.ts`** — Zod: `clientCreateSchema` (kind ∈ {person,company}; name 1–120 no vacío; email válido si presente; doc_id/phone/address/contact_name/notes opcionales; type_id uuid|null), `clientUpdateSchema` (todos opcionales salvo consistencia), `clientTypeCreateSchema` (name 1–40), `clientTypeUpdateSchema` (name?, active?). Tipos con `z.infer`.
- **`permissions.ts`** — puros: `canArchiveClient(role)` y `canManageClientTypes(role)` → `role === 'owner' || role === 'admin'`.
- **`queries.ts`** — reciben un cliente Supabase (RLS-scoped): `listClients(sb, {search, typeId, status, page, pageSize})` (paginado server-side; status ∈ activos|archivados|todos), `getClient(sb, id)`, `listClientTypes(sb, {includeInactive})`, `clientsKpi(sb)` → `{ total, newThisMonth }`, `clientsByType(sb)` → `[{ typeId, name, count }]`.
  - **Degradación segura:** `clientsKpi`/`clientsByType` los consume el dashboard, que también ven roles SIN acceso a Clientes (cajero/almacén ven Inicio). Ante error/permission-denied de RLS deben devolver valores vacíos (`{ total: 0, newThisMonth: 0 }` / `[]`) — nunca lanzar — para que el dashboard muestre el empty state en vez de crashear.
- **`mutations.ts`** — reciben Supabase (confían en RLS): `createClient`, `updateClient`, `archiveClient(sb, id, active)`, `createClientType`, `updateClientType`.
- **`src/app/(app)/clientes/actions.ts`** — `"use server"`: obtienen cliente Supabase server + rol (de `memberships`), **validan con Zod**, **aplican la regla de rol** (archivar/gestión de tipos exigen `canArchiveClient`/`canManageClientTypes`), llaman a la capa de datos, `revalidatePath`. Devuelven `{ ok: boolean, error?: string, fieldErrors?: Record<string,string> }`.

**Flujo de escritura:** form → Server Action → Zod → chequeo de rol → `mutations.*` → Supabase (RLS) → `revalidatePath`.

## UI

Lenguaje visual del Plan 2 (tokens Teal & Slate, Radix, `EmptyState`).

- **`/clientes` (lista)** — server component; lee `listClients` desde `searchParams` (search, tipo, estado, página). Tabla en escritorio (Nombre · Tipo(chip) · Teléfono/Email · Estado), cards en móvil; fila cliqueable → detalle; paginación server-side. Toolbar: buscador + filtro por tipo + filtro estado (Activos/Archivados/Todos). Header con "Nuevo cliente". Empty state "Aún no tienes clientes" + CTA.
- **`/clientes/nuevo` (crear)** — form (client) con Server Action `createClient`; set de campos estándar; selector de tipo con **"crear tipo al vuelo"** (usa `createClientType`); errores de Zod en línea. Al crear → redirect a `/clientes/[id]`.
- **`/clientes/[id]` (detalle)** — datos del cliente + acciones **Editar** y **Archivar/Reactivar** (según rol; oculto para vendedor). Secciones "Historial de compras" y "Por cobrar" como **empty states** ("llegan con Facturación"). Chip si está archivado.
- **`/clientes/[id]/editar`** — reusa el form component con `updateClient`.
- **`/configuracion/tipos-de-cliente` (owner/admin)** — lista de tipos + crear/renombrar/desactivar (Server Actions). Nuevo child en `CONFIG_SECTION` de `nav.ts`, con `resource: "billing"` (gate owner/admin).

**Componentes** en `src/components/clientes/`: `client-form.tsx` (compartido crear/editar, con selector de tipo + crear-al-vuelo), `clients-table.tsx`, `client-row-card.tsx` (móvil), `clients-toolbar.tsx` (buscador+filtros, actualiza la URL), `type-badge.tsx`. Reusa `EmptyState`.

## Dashboard

- **KPI "Total de clientes"** (escritorio y móvil): el dashboard llama a `clientsKpi(sb)` y pasa `value` (total activos) + `sub`/`trend` (nuevos del mes) a la `KpiCard` existente; si no hay clientes, se mantiene el empty state.
- **Widget "Clientes por tipo"** (solo escritorio, per design-system §7 — no en inicio móvil): nuevo widget alimentado por `clientsByType(sb)`, en el grid del dashboard de escritorio, con empty state propio.
- Acoplamiento limpio: el dashboard importa desde `src/lib/clientes/queries.ts`; la lógica vive en el módulo.

## Testing

- **Unit:** `permissions.test.ts` (canArchiveClient/canManageClientTypes solo owner/admin); `schema.test.ts` (Zod rechaza email inválido, exige name/kind).
- **Integración (Supabase local + RLS, serial, patrón Plan 1):**
  - Aislamiento: tenant A no ve clientes de B.
  - Gateo por rol: `cajero` no puede leer/insertar clientes (RLS niega); `vendedor` puede crear/editar clientes pero NO renombrar un tipo (RLS `client_types_update` niega).
  - `createClient`/`updateClient`/`archiveClient` (active=false) OK; `clientsKpi`/`clientsByType` devuelven conteos correctos.
  - Siembra: un tenant nuevo (vía `bootstrap_tenant`) tiene "Minorista" y "Mayorista".
- **E2E manual:** lista con búsqueda/filtros/paginación; crear con "crear tipo al vuelo"; detalle; editar; archivar/reactivar; pantalla de tipos (owner); dashboard con KPI + widget reales; role-gating (vendedor sin botón Archivar; cajero sin ruta/menú de Clientes).
- **Regresión:** suite existente verde + `npm run build` limpio.

## Fuera de alcance (planes posteriores)

Historial de compras y "por cobrar" en el detalle (Facturación); segmentos conductuales Frecuentes/Nuevos; import/export y de-duplicación/merge de clientes; límite de crédito y condiciones de pago; índice trigram de búsqueda; renombrar/desactivar tipos con reasignación masiva.

## Criterios de éxito

- CRUD de clientes a nivel empresa con tipos configurables, RLS gateada por rol y validación Zod en el servidor.
- Tipos: siembra Minorista/Mayorista + crear al vuelo + pantalla de gestión (owner/admin).
- Lista con búsqueda, filtros (tipo/estado) y paginación; detalle con hooks a futuro; soft-delete (archivar/reactivar).
- Dashboard "Total de clientes" y "Clientes por tipo" con datos reales.
- Tests unit + integración verdes; suite del Plan 1/2 intacta; build limpio.
