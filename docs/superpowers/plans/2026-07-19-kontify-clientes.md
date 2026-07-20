# Kontify — Módulo Clientes (Plan 3): Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** CRUD de clientes por empresa con tipos configurables, soft-delete, RLS gateada por rol y validación Zod en el servidor, más el KPI "Total de clientes" y el widget "Clientes por tipo" del dashboard con datos reales.

**Architecture:** Migraciones SQL (tablas `clients`/`client_types` + RLS + seed en `bootstrap_tenant`). Capa de datos pura en `src/lib/clientes/*` (schema Zod, permissions, queries, mutations) llamada desde Server Actions (validan Zod + rol, `revalidatePath`). Lecturas por server components RLS-scoped. UI con el lenguaje del Plan 2.

**Tech Stack:** Next 16 (App Router, Server Actions, `useActionState`), React 19, Tailwind 4, Supabase (`@supabase/ssr`), **zod**, Vitest 4 (integración contra Supabase local, serial).

**Spec:** `docs/superpowers/specs/2026-07-19-kontify-clientes-design.md`.

---

## Convenciones

- Rama: `feat/clientes` desde `master`. Supabase local corriendo.
- RLS es la barrera real; el menú (`nav.ts`) solo oculta. Rol vía `current_user_role()`.
- Colores/tokens del Plan 2 (`var(--bg|surface|border|text|text-soft)`, utilidades `bg-brand`, clases arbitrarias Tailwind 4). Iconos `lucide-react`. Componentes interactivos con `"use client"`.
- Tests de integración: patrón del Plan 1 (`tests/*.test.ts`, entorno node, serial por `fileParallelism:false`).

## Estructura de archivos

```
supabase/migrations/
  0006_clients_schema.sql       # enum client_kind + tablas client_types/clients + índices
  0007_clients_rls.sql          # policies + grants
  0008_seed_client_types.sql    # bootstrap_tenant siembra Minorista/Mayorista
src/lib/clientes/
  schema.ts        schema.test.ts     # Zod
  permissions.ts   permissions.test.ts
  queries.ts                          # lecturas (RLS-scoped, degradación segura)
  mutations.ts                        # escrituras
src/app/(app)/clientes/
  actions.ts                          # Server Actions (Zod + rol + revalidate)
  page.tsx                            # lista (reemplaza placeholder)
  nuevo/page.tsx                      # crear (reemplaza placeholder)
  [id]/page.tsx                       # detalle
  [id]/editar/page.tsx                # editar
src/app/(app)/configuracion/tipos-de-cliente/page.tsx   # gestión de tipos (owner/admin)
src/components/clientes/
  client-form.tsx      # form compartido crear/editar + crear tipo al vuelo
  clients-table.tsx    # tabla escritorio
  client-row-card.tsx  # card móvil
  clients-toolbar.tsx  # buscador + filtros (URL)
  type-badge.tsx
tests/clientes.test.ts # integración RLS + capa de datos + seed
```

---

## Task 0: Prerequisitos

- [ ] **Step 1: Rama desde master + Supabase**

Run:
```bash
cd ~/admin-saas
git checkout master && git checkout -b feat/clientes
npx supabase status >/dev/null 2>&1 || npx supabase start
```
Expected: en `feat/clientes`, Supabase corriendo.

---

## Task 1: Instalar zod

**Files:** Modify `package.json`, `package-lock.json`

- [ ] **Step 1: Instalar**

Run: `npm i zod`
Expected: sin errores.

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: zod para validación de formularios en el servidor"
```

---

## Task 2: Migración 0006 — esquema de clientes

**Files:** Create `supabase/migrations/0006_clients_schema.sql`

- [ ] **Step 1: Escribir la migración**

```sql
-- 0006_clients_schema.sql
create type public.client_kind as enum ('person','company');

create table public.client_types (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index client_types_tenant_lname on public.client_types (tenant_id, lower(name));
create index client_types_tenant on public.client_types (tenant_id);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  kind public.client_kind not null,
  name text not null,
  doc_id text,
  email text,
  phone text,
  address text,
  contact_name text,
  type_id uuid references public.client_types(id) on delete set null,
  notes text,
  active boolean not null default true,
  created_branch_id uuid references public.branches(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index clients_tenant on public.clients (tenant_id);
create index clients_tenant_active on public.clients (tenant_id, active);
create index clients_tenant_type on public.clients (tenant_id, type_id);
```

- [ ] **Step 2: Aplicar**

Run: `npx supabase migration up`
Expected: `Applying migration 0006_clients_schema.sql...` sin errores.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0006_clients_schema.sql
git commit -m "feat(db): esquema clients + client_types + enum client_kind"
```

---

## Task 3: Migración 0007 — RLS y grants

**Files:** Create `supabase/migrations/0007_clients_rls.sql`

- [ ] **Step 1: Escribir la migración**

```sql
-- 0007_clients_rls.sql
alter table public.client_types enable row level security;
alter table public.clients      enable row level security;

-- client_types: leer/crear (crear al vuelo) los 4 roles con acceso a Clientes; renombrar/desactivar solo owner/admin
create policy client_types_select on public.client_types
  for select using (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin','administrativo','vendedor'));
create policy client_types_insert on public.client_types
  for insert with check (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin','administrativo','vendedor'));
create policy client_types_update on public.client_types
  for update using (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin'))
  with check (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin'));

-- clients: leer/crear/editar los 4 roles con acceso; sin DELETE (soft-delete con active)
create policy clients_select on public.clients
  for select using (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin','administrativo','vendedor'));
create policy clients_insert on public.clients
  for insert with check (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin','administrativo','vendedor'));
create policy clients_update on public.clients
  for update using (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin','administrativo','vendedor'))
  with check (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin','administrativo','vendedor'));

grant select, insert, update on public.client_types to authenticated;
grant select, insert, update on public.clients      to authenticated;
```

- [ ] **Step 2: Aplicar**

Run: `npx supabase migration up`
Expected: aplicada sin errores.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0007_clients_rls.sql
git commit -m "feat(db): RLS + grants de clients/client_types (gate por rol)"
```

---

## Task 4: Migración 0008 — sembrar tipos por defecto en bootstrap_tenant

**Files:** Create `supabase/migrations/0008_seed_client_types.sql`

- [ ] **Step 1: Escribir la migración (reemplaza el RPC añadiendo la siembra)**

```sql
-- 0008_seed_client_types.sql
create or replace function public.bootstrap_tenant(
  p_name text, p_slug text, p_full_name text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_tenant uuid; v_branch uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if exists (select 1 from public.memberships where user_id = auth.uid()) then
    raise exception 'user already belongs to a tenant';
  end if;

  insert into public.tenants(name, slug) values (p_name, lower(p_slug))
    returning id into v_tenant;
  insert into public.branches(tenant_id, name, is_main)
    values (v_tenant, 'Principal', true) returning id into v_branch;
  insert into public.profiles(id, tenant_id, full_name)
    values (auth.uid(), v_tenant, coalesce(p_full_name, ''));
  insert into public.memberships(user_id, tenant_id, role, branch_id)
    values (auth.uid(), v_tenant, 'owner', null);
  insert into public.client_types(tenant_id, name)
    values (v_tenant, 'Minorista'), (v_tenant, 'Mayorista');

  return v_tenant;
end; $$;

revoke all on function public.bootstrap_tenant(text,text,text) from public;
grant execute on function public.bootstrap_tenant(text,text,text) to authenticated;
```

- [ ] **Step 2: Aplicar**

Run: `npx supabase migration up`
Expected: aplicada sin errores.

- [ ] **Step 3: Verificar que la suite del Plan 1 sigue verde (bootstrap no se rompió)**

Run: `npm test -- tests/bootstrap.test.ts`
Expected: PASS (2/2).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0008_seed_client_types.sql
git commit -m "feat(db): bootstrap_tenant siembra tipos Minorista/Mayorista"
```

---

## Task 5: Esquemas Zod (TDD)

**Files:** Create `src/lib/clientes/schema.ts`, `src/lib/clientes/schema.test.ts`

- [ ] **Step 1: Test que falla**

`src/lib/clientes/schema.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { clientCreateSchema, clientTypeCreateSchema } from "@/lib/clientes/schema";

describe("clientCreateSchema", () => {
  it("acepta un cliente válido y normaliza vacíos a undefined", () => {
    const r = clientCreateSchema.safeParse({ kind: "person", name: "Juan", email: "", phone: "0412" });
    expect(r.success).toBe(true);
    if (r.success) { expect(r.data.email).toBeUndefined(); expect(r.data.phone).toBe("0412"); }
  });
  it("exige name no vacío", () => {
    expect(clientCreateSchema.safeParse({ kind: "person", name: "" }).success).toBe(false);
  });
  it("rechaza kind inválido", () => {
    expect(clientCreateSchema.safeParse({ kind: "robot", name: "X" }).success).toBe(false);
  });
  it("rechaza email inválido si viene", () => {
    expect(clientCreateSchema.safeParse({ kind: "person", name: "X", email: "no-mail" }).success).toBe(false);
  });
});

describe("clientTypeCreateSchema", () => {
  it("exige name", () => {
    expect(clientTypeCreateSchema.safeParse({ name: "" }).success).toBe(false);
    expect(clientTypeCreateSchema.safeParse({ name: "VIP" }).success).toBe(true);
  });
});
```

- [ ] **Step 2: Ejecutar — falla**

Run: `npm test -- src/lib/clientes/schema.test.ts`
Expected: FAIL "Cannot find module '@/lib/clientes/schema'".

- [ ] **Step 3: Implementar**

`src/lib/clientes/schema.ts`:
```ts
import { z } from "zod";

export const CLIENT_KINDS = ["person", "company"] as const;

const optStr = (max: number) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().max(max).optional());

const optEmail =
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().email("Email inválido").max(120).optional());

const optTypeId =
  z.preprocess((v) => (v === "" || v === "null" || v === undefined ? null : v),
    z.string().uuid().nullable());

export const clientCreateSchema = z.object({
  kind: z.enum(CLIENT_KINDS, { message: "Tipo inválido" }),
  name: z.string().trim().min(1, "El nombre es obligatorio").max(120),
  docId: optStr(60),
  email: optEmail,
  phone: optStr(40),
  address: optStr(200),
  contactName: optStr(120),
  typeId: optTypeId,
  notes: optStr(1000),
});
export type ClientInput = z.infer<typeof clientCreateSchema>;

export const clientUpdateSchema = clientCreateSchema; // el form de edición envía todos los campos

export const clientTypeCreateSchema = z.object({
  name: z.string().trim().min(1, "Nombre requerido").max(40),
});
export type ClientTypeInput = z.infer<typeof clientTypeCreateSchema>;

export const clientTypeUpdateSchema = z.object({
  name: z.string().trim().min(1).max(40).optional(),
  active: z.boolean().optional(),
});
```

- [ ] **Step 4: Ejecutar — pasa**

Run: `npm test -- src/lib/clientes/schema.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/clientes/schema.ts src/lib/clientes/schema.test.ts
git commit -m "feat(clientes): esquemas Zod con test"
```

---

## Task 6: Permisos (TDD)

**Files:** Create `src/lib/clientes/permissions.ts`, `src/lib/clientes/permissions.test.ts`

- [ ] **Step 1: Test que falla**

`src/lib/clientes/permissions.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { canArchiveClient, canManageClientTypes } from "@/lib/clientes/permissions";

describe("permisos de clientes", () => {
  it("solo owner/admin archivan clientes", () => {
    expect(canArchiveClient("owner")).toBe(true);
    expect(canArchiveClient("admin")).toBe(true);
    expect(canArchiveClient("administrativo")).toBe(false);
    expect(canArchiveClient("vendedor")).toBe(false);
  });
  it("solo owner/admin gestionan tipos", () => {
    expect(canManageClientTypes("owner")).toBe(true);
    expect(canManageClientTypes("vendedor")).toBe(false);
  });
});
```

- [ ] **Step 2: Ejecutar — falla**

Run: `npm test -- src/lib/clientes/permissions.test.ts`
Expected: FAIL "Cannot find module".

- [ ] **Step 3: Implementar**

`src/lib/clientes/permissions.ts`:
```ts
import type { Role } from "@/lib/auth/roles";

export const canArchiveClient = (role: Role): boolean => role === "owner" || role === "admin";
export const canManageClientTypes = (role: Role): boolean => role === "owner" || role === "admin";
```

- [ ] **Step 4: Ejecutar — pasa**

Run: `npm test -- src/lib/clientes/permissions.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/clientes/permissions.ts src/lib/clientes/permissions.test.ts
git commit -m "feat(clientes): helpers de permisos con test"
```

---

## Task 7: Mutaciones (capa de datos)

**Files:** Create `src/lib/clientes/mutations.ts`

- [ ] **Step 1: Implementar**

`src/lib/clientes/mutations.ts`:
```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClientInput } from "@/lib/clientes/schema";

const clientRow = (input: ClientInput) => ({
  kind: input.kind,
  name: input.name,
  doc_id: input.docId ?? null,
  email: input.email ?? null,
  phone: input.phone ?? null,
  address: input.address ?? null,
  contact_name: input.contactName ?? null,
  type_id: input.typeId ?? null,
  notes: input.notes ?? null,
});

export async function createClient(
  sb: SupabaseClient, tenantId: string, userId: string, branchId: string | null, input: ClientInput,
): Promise<string> {
  const { data, error } = await sb.from("clients")
    .insert({ tenant_id: tenantId, created_by: userId, created_branch_id: branchId, ...clientRow(input) })
    .select("id").single();
  if (error) throw error;
  return data.id as string;
}

export async function updateClient(sb: SupabaseClient, id: string, input: ClientInput): Promise<void> {
  const { error } = await sb.from("clients")
    .update({ ...clientRow(input), updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function archiveClient(sb: SupabaseClient, id: string, active: boolean): Promise<void> {
  const { error } = await sb.from("clients")
    .update({ active, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function createClientType(sb: SupabaseClient, tenantId: string, name: string) {
  const { data, error } = await sb.from("client_types")
    .insert({ tenant_id: tenantId, name }).select("id, name").single();
  if (error) throw error;
  return data as { id: string; name: string };
}

export async function updateClientType(sb: SupabaseClient, id: string, patch: { name?: string; active?: boolean }) {
  const { error } = await sb.from("client_types").update(patch).eq("id", id);
  if (error) throw error;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/lib/clientes/mutations.ts
git commit -m "feat(clientes): capa de mutaciones (create/update/archive + tipos)"
```

---

## Task 8: Queries (capa de datos, degradación segura)

**Files:** Create `src/lib/clientes/queries.ts`

- [ ] **Step 1: Implementar**

`src/lib/clientes/queries.ts`:
```ts
import type { SupabaseClient } from "@supabase/supabase-js";

export type ClientListRow = {
  id: string; name: string; kind: "person" | "company";
  phone: string | null; email: string | null; active: boolean;
  typeId: string | null; typeName: string | null;
};
export type ClientStatus = "activos" | "archivados" | "todos";

// Neutraliza caracteres con significado en filtros PostgREST para evitar inyección en .or()
function sanitize(term: string): string {
  return term.replace(/[%,()*]/g, " ").trim();
}

export async function listClients(sb: SupabaseClient, opts: {
  search?: string; typeId?: string | null; status?: ClientStatus; page?: number; pageSize?: number;
} = {}): Promise<{ rows: ClientListRow[]; total: number; page: number; pageSize: number }> {
  const { search = "", typeId = null, status = "activos", page = 1, pageSize = 20 } = opts;
  let q = sb.from("clients").select("id, name, kind, phone, email, active, type_id, client_types(name)", { count: "exact" });
  if (status === "activos") q = q.eq("active", true);
  else if (status === "archivados") q = q.eq("active", false);
  if (typeId) q = q.eq("type_id", typeId);
  const s = sanitize(search);
  if (s) q = q.or(`name.ilike.%${s}%,phone.ilike.%${s}%,email.ilike.%${s}%,doc_id.ilike.%${s}%`);
  const from = (page - 1) * pageSize;
  q = q.order("name").range(from, from + pageSize - 1);
  const { data, error, count } = await q;
  if (error) throw error;
  const rows: ClientListRow[] = (data ?? []).map((r: any) => ({
    id: r.id, name: r.name, kind: r.kind, phone: r.phone, email: r.email, active: r.active,
    typeId: r.type_id, typeName: r.client_types?.name ?? null,
  }));
  return { rows, total: count ?? 0, page, pageSize };
}

export async function getClient(sb: SupabaseClient, id: string) {
  const { data, error } = await sb.from("clients").select("*, client_types(name)").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as any;
}

export async function listClientTypes(sb: SupabaseClient, opts: { includeInactive?: boolean } = {}) {
  let q = sb.from("client_types").select("id, name, active").order("name");
  if (!opts.includeInactive) q = q.eq("active", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as { id: string; name: string; active: boolean }[];
}

// Consumidas por el dashboard, que también ven roles SIN acceso a Clientes (cajero/almacén):
// ante error/permiso denegado devuelven vacío, nunca lanzan, para no crashear el dashboard.
export async function clientsKpi(sb: SupabaseClient): Promise<{ total: number; newThisMonth: number }> {
  try {
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const total = await sb.from("clients").select("id", { count: "exact", head: true }).eq("active", true);
    const fresh = await sb.from("clients").select("id", { count: "exact", head: true })
      .eq("active", true).gte("created_at", monthStart.toISOString());
    if (total.error || fresh.error) return { total: 0, newThisMonth: 0 };
    return { total: total.count ?? 0, newThisMonth: fresh.count ?? 0 };
  } catch { return { total: 0, newThisMonth: 0 }; }
}

export async function clientsByType(sb: SupabaseClient): Promise<{ typeId: string | null; name: string; count: number }[]> {
  try {
    const { data, error } = await sb.from("clients").select("type_id, client_types(name)").eq("active", true);
    if (error || !data) return [];
    const map = new Map<string, { typeId: string | null; name: string; count: number }>();
    for (const r of data as any[]) {
      const key = r.type_id ?? "none";
      const cur = map.get(key) ?? { typeId: r.type_id ?? null, name: r.client_types?.name ?? "Sin tipo", count: 0 };
      cur.count++; map.set(key, cur);
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
  } catch { return []; }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/lib/clientes/queries.ts
git commit -m "feat(clientes): capa de queries (lista/detalle/tipos/kpi) con degradación segura"
```

---

## Task 9: Tests de integración (RLS + capa de datos + seed)

**Files:** Create `tests/clientes.test.ts`

- [ ] **Step 1: Escribir el test**

`tests/clientes.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { newUserClient } from "./setup";
import { createClient, archiveClient } from "@/lib/clientes/mutations";
import { listClients, listClientTypes, clientsKpi, clientsByType } from "@/lib/clientes/queries";

async function makeTenant(name: string) {
  const u = await newUserClient();
  const { data: tenantId } = await u.client.rpc("bootstrap_tenant", {
    p_name: name, p_slug: `${name}-${Date.now()}-${Math.random()}`, p_full_name: name,
  });
  return { ...u, tenantId: tenantId as string };
}

// Crea un usuario con un rol dado dentro del tenant del owner (el owner puede insertar memberships por RLS)
async function addMember(owner: Awaited<ReturnType<typeof makeTenant>>, role: string) {
  const u = await newUserClient();
  const { error } = await owner.client.from("memberships")
    .insert({ user_id: u.id, tenant_id: owner.tenantId, role });
  if (error) throw error;
  return u;
}

describe("clientes — seed y CRUD", () => {
  it("un tenant nuevo trae Minorista y Mayorista", async () => {
    const a = await makeTenant("seed");
    const types = await listClientTypes(a.client);
    expect(types.map((t) => t.name).sort()).toEqual(["Mayorista", "Minorista"]);
  });

  it("crear, listar, archivar y contar", async () => {
    const a = await makeTenant("crud");
    const types = await listClientTypes(a.client);
    const id = await createClient(a.client, a.tenantId, a.id, null,
      { kind: "person", name: "Juan Pérez", phone: "0412", typeId: types[0].id });
    expect(id).toBeTruthy();

    const activos = await listClients(a.client, { status: "activos" });
    expect(activos.total).toBe(1);
    expect(activos.rows[0].typeName).toBe(types[0].name);

    const kpi = await clientsKpi(a.client);
    expect(kpi.total).toBe(1);
    expect(kpi.newThisMonth).toBe(1);

    const byType = await clientsByType(a.client);
    expect(byType.find((t) => t.typeId === types[0].id)?.count).toBe(1);

    await archiveClient(a.client, id, false);
    expect((await listClients(a.client, { status: "activos" })).total).toBe(0);
    expect((await listClients(a.client, { status: "archivados" })).total).toBe(1);
  });

  it("búsqueda por nombre", async () => {
    const a = await makeTenant("srch");
    await createClient(a.client, a.tenantId, a.id, null, { kind: "company", name: "Farmacia Sol" });
    await createClient(a.client, a.tenantId, a.id, null, { kind: "person", name: "Pedro Luna" });
    const r = await listClients(a.client, { search: "farmacia" });
    expect(r.total).toBe(1);
    expect(r.rows[0].name).toBe("Farmacia Sol");
  });
});

describe("clientes — RLS", () => {
  it("un tenant no ve clientes de otro", async () => {
    const a = await makeTenant("aa");
    const b = await makeTenant("bb");
    await createClient(a.client, a.tenantId, a.id, null, { kind: "person", name: "Cliente A" });
    const fromB = await listClients(b.client, { status: "todos" });
    expect(fromB.total).toBe(0);
  });

  it("un cajero no puede ver ni crear clientes", async () => {
    const a = await makeTenant("cc");
    const cajero = await addMember(a, "cajero");
    const { data: rows } = await cajero.client.from("clients").select("*");
    expect(rows).toHaveLength(0); // RLS filtra
    const { error } = await cajero.client.from("clients")
      .insert({ tenant_id: a.tenantId, kind: "person", name: "X" });
    expect(error).not.toBeNull(); // RLS niega el insert
  });

  it("un vendedor puede crear clientes pero no renombrar un tipo", async () => {
    const a = await makeTenant("dd");
    const vendedor = await addMember(a, "vendedor");
    const cid = await createClient(vendedor.client, a.tenantId, vendedor.id, null, { kind: "person", name: "V-cliente" });
    expect(cid).toBeTruthy();

    const types = await listClientTypes(vendedor.client);
    const original = types[0].name;
    await vendedor.client.from("client_types").update({ name: "Hackeado" }).eq("id", types[0].id);
    const after = await listClientTypes(a.client);
    expect(after.find((t) => t.id === types[0].id)?.name).toBe(original); // RLS impidió el cambio
  });
});
```

- [ ] **Step 2: Ejecutar**

Run: `npm test -- tests/clientes.test.ts`
Expected: PASS (todos). Si falla el insert del cajero por no dar error sino 0 filas, revisar que la policy `clients_insert` incluye el gate de rol (debe negar → error de RLS).

- [ ] **Step 3: Suite completa verde**

Run: `npm test`
Expected: PASS en todo (Plan 1/2 + clientes).

- [ ] **Step 4: Commit**

```bash
git add tests/clientes.test.ts
git commit -m "test(clientes): integración RLS + CRUD + seed + kpi"
```

---

## Task 10: Server Actions

**Files:** Create `src/app/(app)/clientes/actions.ts`

- [ ] **Step 1: Implementar**

`src/app/(app)/clientes/actions.ts`:
```ts
"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient as serverSupabase } from "@/lib/supabase/server";
import { clientCreateSchema, clientTypeCreateSchema, clientTypeUpdateSchema } from "@/lib/clientes/schema";
import { canArchiveClient, canManageClientTypes } from "@/lib/clientes/permissions";
import * as m from "@/lib/clientes/mutations";
import type { Role } from "@/lib/auth/roles";

export type FormState = { ok: boolean; error?: string; fieldErrors?: Record<string, string> };

function zodErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of err.issues) { const k = String(i.path[0] ?? "_"); if (!out[k]) out[k] = i.message; }
  return out;
}

const clientFields = (fd: FormData) => ({
  kind: fd.get("kind"), name: fd.get("name"), docId: fd.get("docId"), email: fd.get("email"),
  phone: fd.get("phone"), address: fd.get("address"), contactName: fd.get("contactName"),
  typeId: fd.get("typeId"), notes: fd.get("notes"),
});

async function ctx() {
  const sb = await serverSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const { data: mem } = await sb.from("memberships").select("role").eq("user_id", user.id).single();
  const { data: tenantId } = await sb.rpc("current_tenant_id");
  return { sb, userId: user.id, role: (mem?.role ?? "vendedor") as Role, tenantId: tenantId as string };
}

export async function createClientAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { sb, userId, tenantId } = await ctx();
  const parsed = clientCreateSchema.safeParse(clientFields(fd));
  if (!parsed.success) return { ok: false, fieldErrors: zodErrors(parsed.error) };
  let id: string;
  try { id = await m.createClient(sb, tenantId, userId, null, parsed.data); }
  catch (e) { return { ok: false, error: (e as Error).message }; }
  revalidatePath("/clientes");
  redirect(`/clientes/${id}`);
}

export async function updateClientAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { sb } = await ctx();
  const id = String(fd.get("id") ?? "");
  const parsed = clientCreateSchema.safeParse(clientFields(fd));
  if (!parsed.success) return { ok: false, fieldErrors: zodErrors(parsed.error) };
  try { await m.updateClient(sb, id, parsed.data); }
  catch (e) { return { ok: false, error: (e as Error).message }; }
  revalidatePath(`/clientes/${id}`);
  redirect(`/clientes/${id}`);
}

export async function archiveClientAction(fd: FormData): Promise<void> {
  const { sb, role } = await ctx();
  if (!canArchiveClient(role)) return; // el botón no se muestra a vendedor; defensa extra
  const id = String(fd.get("id") ?? "");
  const active = fd.get("active") === "true";
  await m.archiveClient(sb, id, active);
  revalidatePath("/clientes");
  revalidatePath(`/clientes/${id}`);
}

// Variante para <form action=...> de la pantalla de gestión (firma de form-action, sin estado de retorno).
export async function createClientTypeFormAction(fd: FormData): Promise<void> {
  const { sb, tenantId } = await ctx();
  const parsed = clientTypeCreateSchema.safeParse({ name: fd.get("name") });
  if (!parsed.success) return;
  try { await m.createClientType(sb, tenantId, parsed.data.name); } catch { return; }
  revalidatePath("/configuracion/tipos-de-cliente");
}

// Variante llamable DIRECTAMENTE desde un client component (crear tipo al vuelo en el formulario de cliente).
export async function createClientTypeNamed(
  name: string,
): Promise<{ ok: boolean; type?: { id: string; name: string }; error?: string }> {
  const { sb, tenantId } = await ctx();
  const parsed = clientTypeCreateSchema.safeParse({ name });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };
  try {
    const t = await m.createClientType(sb, tenantId, parsed.data.name);
    revalidatePath("/clientes");
    return { ok: true, type: t };
  } catch (e) { return { ok: false, error: (e as Error).message }; }
}

export async function updateClientTypeAction(fd: FormData): Promise<void> {
  const { sb, role } = await ctx();
  if (!canManageClientTypes(role)) return;
  const id = String(fd.get("id") ?? "");
  const patch: { name?: string; active?: boolean } = {};
  if (fd.has("name")) patch.name = String(fd.get("name"));
  if (fd.has("active")) patch.active = fd.get("active") === "true";
  const parsed = clientTypeUpdateSchema.safeParse(patch);
  if (!parsed.success) return;
  await m.updateClientType(sb, id, parsed.data);
  revalidatePath("/configuracion/tipos-de-cliente");
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/clientes/actions.ts"
git commit -m "feat(clientes): Server Actions (Zod + rol + revalidate)"
```

---

## Task 11: Nav — añadir "Tipos de cliente" a Configuración

**Files:** Modify `src/lib/nav.ts`, `src/lib/nav.test.ts`

- [ ] **Step 1: Añadir el child al CONFIG_SECTION**

En `src/lib/nav.ts`, en el array `children` de `CONFIG_SECTION`, añadir como primer hijo (antes de "Sucursales") o tras "Usuarios y roles"; usar el icono `Tags`. Añadir `Tags` al import de `lucide-react`. Insertar esta entrada en `children`:
```ts
    { label: "Tipos de cliente", href: "/configuracion/tipos-de-cliente", icon: Tags, resource: "billing" },
```
(Import: agregar `Tags` a la lista importada de `lucide-react`.)

- [ ] **Step 2: Actualizar el test de config**

En `src/lib/nav.test.ts`, el test "owner ve las 3 opciones de Configuración" ahora son 4; y cajero sigue viendo solo "Preferencias". Reemplazar ese bloque `describe("configForRole"...)` por:
```ts
describe("configForRole", () => {
  it("owner ve las 4 opciones de Configuración", () => {
    expect(configForRole("owner")!.children).toHaveLength(4);
  });
  it("cajero solo ve Preferencias dentro de Configuración", () => {
    expect(configForRole("cajero")!.children.map((c) => c.label)).toEqual(["Preferencias"]);
  });
});
```

- [ ] **Step 3: Ejecutar**

Run: `npm test -- src/lib/nav.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/nav.ts src/lib/nav.test.ts
git commit -m "feat(nav): Configuración → Tipos de cliente (owner/admin)"
```

---

## Task 12: Componentes UI base (type-badge, toolbar, table, row-card)

**Files:** Create `src/components/clientes/type-badge.tsx`, `clients-toolbar.tsx`, `clients-table.tsx`, `client-row-card.tsx`

- [ ] **Step 1: `type-badge.tsx`**

```tsx
export function TypeBadge({ name }: { name: string | null }) {
  if (!name) return <span className="text-xs text-[var(--text-soft)]">—</span>;
  return (
    <span className="inline-flex items-center rounded-full bg-[#0e7490]/10 px-2 py-0.5 text-xs font-medium text-[#0e7490] dark:text-[#5eead4]">
      {name}
    </span>
  );
}
```

- [ ] **Step 2: `clients-toolbar.tsx`** (client; actualiza searchParams)

```tsx
"use client";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

export function ClientsToolbar({ types }: { types: { id: string; name: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value); else next.delete(key);
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  }

  const sel = "h-9 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 text-sm text-[var(--text)]";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex h-9 min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-[var(--text-soft)]">
        <Search className="h-4 w-4" strokeWidth={2} />
        <input defaultValue={sp.get("q") ?? ""} placeholder="Buscar por nombre, teléfono, email…"
          onKeyDown={(e) => { if (e.key === "Enter") setParam("q", (e.target as HTMLInputElement).value); }}
          className="w-full bg-transparent text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-soft)]" />
      </div>
      <select className={sel} defaultValue={sp.get("type") ?? ""} onChange={(e) => setParam("type", e.target.value)}>
        <option value="">Todos los tipos</option>
        {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
      <select className={sel} defaultValue={sp.get("status") ?? "activos"} onChange={(e) => setParam("status", e.target.value)}>
        <option value="activos">Activos</option>
        <option value="archivados">Archivados</option>
        <option value="todos">Todos</option>
      </select>
    </div>
  );
}
```

- [ ] **Step 3: `clients-table.tsx`** (escritorio)

```tsx
import Link from "next/link";
import type { ClientListRow } from "@/lib/clientes/queries";
import { TypeBadge } from "./type-badge";

export function ClientsTable({ rows }: { rows: ClientListRow[] }) {
  return (
    <table className="hidden w-full text-sm lg:table">
      <thead>
        <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--text-soft)]">
          <th className="py-2 font-medium">Nombre</th><th className="font-medium">Tipo</th>
          <th className="font-medium">Contacto</th><th className="font-medium">Estado</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className="border-b border-[var(--border)] hover:bg-[var(--bg)]">
            <td className="py-2.5">
              <Link href={`/clientes/${r.id}`} className="font-medium text-[var(--text)] hover:text-[#0e7490]">{r.name}</Link>
              <span className="ml-2 text-xs text-[var(--text-soft)]">{r.kind === "company" ? "Empresa" : "Persona"}</span>
            </td>
            <td><TypeBadge name={r.typeName} /></td>
            <td className="text-[var(--text-soft)]">{r.phone || r.email || "—"}</td>
            <td>{r.active
              ? <span className="text-xs font-medium text-[#0f766e] dark:text-[#6ee7b7]">Activo</span>
              : <span className="text-xs font-medium text-[var(--text-soft)]">Archivado</span>}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 4: `client-row-card.tsx`** (móvil)

```tsx
import Link from "next/link";
import type { ClientListRow } from "@/lib/clientes/queries";
import { TypeBadge } from "./type-badge";

export function ClientRowCard({ r }: { r: ClientListRow }) {
  return (
    <Link href={`/clientes/${r.id}`}
      className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 lg:hidden">
      <div className="min-w-0">
        <p className="truncate font-medium text-[var(--text)]">{r.name}</p>
        <p className="truncate text-xs text-[var(--text-soft)]">{r.phone || r.email || "—"}</p>
      </div>
      <div className="flex flex-none items-center gap-2">
        <TypeBadge name={r.typeName} />
        {!r.active && <span className="text-xs text-[var(--text-soft)]">Archivado</span>}
      </div>
    </Link>
  );
}
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/components/clientes/type-badge.tsx src/components/clientes/clients-toolbar.tsx src/components/clientes/clients-table.tsx src/components/clientes/client-row-card.tsx
git commit -m "feat(clientes): componentes de lista (badge, toolbar, table, card)"
```

---

## Task 13: Formulario compartido de cliente

**Files:** Create `src/components/clientes/client-form.tsx`

- [ ] **Step 1: Implementar**

`src/components/clientes/client-form.tsx`:
```tsx
"use client";
import { useActionState, useState } from "react";
import { createClientTypeNamed, type FormState } from "@/app/(app)/clientes/actions";

type ClientType = { id: string; name: string };
type Values = {
  id?: string; kind?: "person" | "company"; name?: string; docId?: string; email?: string;
  phone?: string; address?: string; contactName?: string; typeId?: string | null; notes?: string;
};

const initial: FormState = { ok: false };
const inputCls = "w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[#0e7490]";
const labelCls = "mb-1 block text-xs font-medium text-[var(--text-soft)]";

export function ClientForm({ action, types, values = {}, submitLabel }: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  types: ClientType[]; values?: Values; submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, initial);
  const [localTypes, setLocalTypes] = useState<ClientType[]>(types);
  const [typeId, setTypeId] = useState<string>(values.typeId ?? "");
  const [adding, setAdding] = useState(false);
  const [newType, setNewType] = useState("");
  const [typeErr, setTypeErr] = useState("");
  const [creating, setCreating] = useState(false);
  const err = (k: string) => state.fieldErrors?.[k];

  async function addType() {
    setCreating(true); setTypeErr("");
    const r = await createClientTypeNamed(newType);   // server action llamada directamente
    setCreating(false);
    if (!r.ok || !r.type) { setTypeErr(r.error ?? "No se pudo crear"); return; }
    setLocalTypes((prev) => [...prev, r.type!].sort((a, b) => a.name.localeCompare(b.name)));
    setTypeId(r.type.id); setNewType(""); setAdding(false);
  }

  return (
    <form action={formAction} className="max-w-xl space-y-3">
      {values.id && <input type="hidden" name="id" defaultValue={values.id} />}
      <input type="hidden" name="typeId" value={typeId} />
      <div>
        <label className={labelCls}>Tipo de registro</label>
        <select name="kind" defaultValue={values.kind ?? "person"} className={inputCls}>
          <option value="person">Persona</option>
          <option value="company">Empresa</option>
        </select>
      </div>
      <div>
        <label className={labelCls}>Nombre / Razón social *</label>
        <input name="name" defaultValue={values.name ?? ""} className={inputCls} />
        {err("name") && <p className="mt-1 text-xs text-[#dc2626]">{err("name")}</p>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={labelCls}>Documento / ID</label><input name="docId" defaultValue={values.docId ?? ""} className={inputCls} /></div>
        <div><label className={labelCls}>Teléfono</label><input name="phone" defaultValue={values.phone ?? ""} className={inputCls} /></div>
      </div>
      <div>
        <label className={labelCls}>Email</label>
        <input name="email" type="email" defaultValue={values.email ?? ""} className={inputCls} />
        {err("email") && <p className="mt-1 text-xs text-[#dc2626]">{err("email")}</p>}
      </div>
      <div><label className={labelCls}>Dirección</label><input name="address" defaultValue={values.address ?? ""} className={inputCls} /></div>
      <div><label className={labelCls}>Persona de contacto</label><input name="contactName" defaultValue={values.contactName ?? ""} className={inputCls} /></div>
      <div>
        <label className={labelCls}>Tipo de cliente</label>
        <div className="flex gap-2">
          <select value={typeId} onChange={(e) => setTypeId(e.target.value)} className={inputCls}>
            <option value="">Sin tipo</option>
            {localTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <button type="button" onClick={() => setAdding((v) => !v)}
            className="flex-none rounded-[10px] border border-[var(--border)] px-3 text-sm text-[var(--text)]">+ Tipo</button>
        </div>
        {adding && (
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-dashed border-[var(--border)] p-2">
            <input value={newType} onChange={(e) => setNewType(e.target.value)} placeholder="Nuevo tipo (ej. VIP)" className={inputCls} />
            <button type="button" onClick={addType} disabled={creating || !newType.trim()}
              className="flex-none rounded-[10px] bg-[#0e7490] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">
              {creating ? "…" : "Crear"}
            </button>
          </div>
        )}
        {typeErr && <p className="mt-1 text-xs text-[#dc2626]">{typeErr}</p>}
      </div>
      <div><label className={labelCls}>Notas</label><textarea name="notes" defaultValue={values.notes ?? ""} rows={3} className={inputCls} /></div>

      {state.error && <p className="text-sm text-[#dc2626]">{state.error}</p>}
      <button disabled={pending} className="rounded-[10px] bg-gradient-to-br from-[#0e7490] to-[#14b8a6] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
        {pending ? "Guardando…" : submitLabel}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/components/clientes/client-form.tsx
git commit -m "feat(clientes): formulario compartido crear/editar + crear tipo al vuelo"
```

---

## Task 14: Página de lista `/clientes`

**Files:** Overwrite `src/app/(app)/clientes/page.tsx`

- [ ] **Step 1: Implementar (reemplaza el placeholder)**

`src/app/(app)/clientes/page.tsx`:
```tsx
import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { listClients, listClientTypes, type ClientStatus } from "@/lib/clientes/queries";
import { ClientsToolbar } from "@/components/clientes/clients-toolbar";
import { ClientsTable } from "@/components/clientes/clients-table";
import { ClientRowCard } from "@/components/clientes/client-row-card";
import { EmptyState } from "@/components/shared/empty-state";

export default async function ClientesPage({ searchParams }: {
  searchParams: Promise<{ q?: string; type?: string; status?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const sb = await createClient();
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const status = (["activos", "archivados", "todos"].includes(sp.status ?? "") ? sp.status : "activos") as ClientStatus;

  const [types, list] = await Promise.all([
    listClientTypes(sb),
    listClients(sb, { search: sp.q ?? "", typeId: sp.type || null, status, page }),
  ]);
  const pages = Math.max(1, Math.ceil(list.total / list.pageSize));

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold tracking-[-0.4px] text-[var(--text)]">Clientes</h1>
        <Link href="/clientes/nuevo"
          className="flex items-center gap-1.5 rounded-[10px] bg-gradient-to-br from-[#0e7490] to-[#14b8a6] px-3 py-2 text-sm font-semibold text-white">
          <Plus className="h-4 w-4" strokeWidth={2.5} /> Nuevo cliente
        </Link>
      </div>

      <ClientsToolbar types={types} />

      {list.rows.length === 0 ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
          <EmptyState icon={Users} title="Aún no tienes clientes" hint="Crea el primero con “Nuevo cliente”." />
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-2 lg:p-4">
          <ClientsTable rows={list.rows} />
          <div className="space-y-2 lg:hidden">{list.rows.map((r) => <ClientRowCard key={r.id} r={r} />)}</div>
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <PageLink sp={sp} page={page - 1} disabled={page <= 1}>‹</PageLink>
          <span className="text-[var(--text-soft)]">{page} / {pages}</span>
          <PageLink sp={sp} page={page + 1} disabled={page >= pages}>›</PageLink>
        </div>
      )}
    </div>
  );
}

function PageLink({ sp, page, disabled, children }: {
  sp: Record<string, string | undefined>; page: number; disabled: boolean; children: React.ReactNode;
}) {
  if (disabled) return <span className="px-2 text-[var(--text-soft)] opacity-40">{children}</span>;
  const params = new URLSearchParams();
  if (sp.q) params.set("q", sp.q); if (sp.type) params.set("type", sp.type);
  if (sp.status) params.set("status", sp.status); params.set("page", String(page));
  return <Link href={`/clientes?${params.toString()}`} className="rounded px-2 text-[var(--text)] hover:bg-[var(--bg)]">{children}</Link>;
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: build OK.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/clientes/page.tsx"
git commit -m "feat(clientes): página de lista con búsqueda/filtros/paginación"
```

---

## Task 15: Páginas crear / detalle / editar

**Files:** Overwrite `src/app/(app)/clientes/nuevo/page.tsx`; Create `src/app/(app)/clientes/[id]/page.tsx`, `src/app/(app)/clientes/[id]/editar/page.tsx`

- [ ] **Step 1: `nuevo/page.tsx` (reemplaza placeholder)**

```tsx
import { createClient } from "@/lib/supabase/server";
import { listClientTypes } from "@/lib/clientes/queries";
import { createClientAction } from "@/app/(app)/clientes/actions";
import { ClientForm } from "@/components/clientes/client-form";

export default async function NuevoClientePage() {
  const sb = await createClient();
  const types = await listClientTypes(sb);
  return (
    <div className="p-6">
      <h1 className="mb-4 text-xl font-extrabold tracking-[-0.4px] text-[var(--text)]">Nuevo cliente</h1>
      <ClientForm action={createClientAction} types={types} submitLabel="Crear cliente" />
    </div>
  );
}
```

- [ ] **Step 2: `[id]/page.tsx` (detalle)**

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, ShoppingBag, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getClient } from "@/lib/clientes/queries";
import { canArchiveClient } from "@/lib/clientes/permissions";
import { archiveClientAction } from "@/app/(app)/clientes/actions";
import { EmptyState } from "@/components/shared/empty-state";
import { TypeBadge } from "@/components/clientes/type-badge";
import type { Role } from "@/lib/auth/roles";

export default async function ClienteDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createClient();
  const c = await getClient(sb, id);
  if (!c) notFound();
  const { data: { user } } = await sb.auth.getUser();
  const { data: mem } = await sb.from("memberships").select("role").eq("user_id", user!.id).single();
  const role = (mem?.role ?? "vendedor") as Role;

  const field = (label: string, value: string | null) => (
    <div><p className="text-xs text-[var(--text-soft)]">{label}</p><p className="text-sm text-[var(--text)]">{value || "—"}</p></div>
  );

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-extrabold tracking-[-0.4px] text-[var(--text)]">{c.name}</h1>
          <TypeBadge name={c.client_types?.name ?? null} />
          {!c.active && <span className="rounded-full bg-[var(--bg)] px-2 py-0.5 text-xs text-[var(--text-soft)]">Archivado</span>}
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/clientes/${c.id}/editar`}
            className="flex items-center gap-1.5 rounded-[10px] border border-[var(--border)] px-3 py-2 text-sm text-[var(--text)]">
            <Pencil className="h-4 w-4" /> Editar
          </Link>
          {canArchiveClient(role) && (
            <form action={archiveClientAction}>
              <input type="hidden" name="id" value={c.id} />
              <input type="hidden" name="active" value={c.active ? "false" : "true"} />
              <button className="rounded-[10px] border border-[var(--border)] px-3 py-2 text-sm text-[var(--text)]">
                {c.active ? "Archivar" : "Reactivar"}
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="grid gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:grid-cols-2">
        {field("Tipo de registro", c.kind === "company" ? "Empresa" : "Persona")}
        {field("Documento / ID", c.doc_id)}
        {field("Teléfono", c.phone)}
        {field("Email", c.email)}
        {field("Dirección", c.address)}
        {field("Persona de contacto", c.contact_name)}
        <div className="sm:col-span-2">{field("Notas", c.notes)}</div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
          <EmptyState icon={ShoppingBag} title="Historial de compras" hint="Llega con el módulo de Facturación." />
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
          <EmptyState icon={Wallet} title="Por cobrar" hint="Llega con el módulo de Facturación." />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: `[id]/editar/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getClient, listClientTypes } from "@/lib/clientes/queries";
import { updateClientAction } from "@/app/(app)/clientes/actions";
import { ClientForm } from "@/components/clientes/client-form";

export default async function EditarClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createClient();
  const [c, types] = await Promise.all([getClient(sb, id), listClientTypes(sb)]);
  if (!c) notFound();
  return (
    <div className="p-6">
      <h1 className="mb-4 text-xl font-extrabold tracking-[-0.4px] text-[var(--text)]">Editar cliente</h1>
      <ClientForm action={updateClientAction} types={types} submitLabel="Guardar cambios"
        values={{ id: c.id, kind: c.kind, name: c.name, docId: c.doc_id ?? "", email: c.email ?? "",
          phone: c.phone ?? "", address: c.address ?? "", contactName: c.contact_name ?? "",
          typeId: c.type_id ?? "", notes: c.notes ?? "" }} />
    </div>
  );
}
```

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: build OK.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/clientes/nuevo/page.tsx" "src/app/(app)/clientes/[id]/page.tsx" "src/app/(app)/clientes/[id]/editar/page.tsx"
git commit -m "feat(clientes): páginas crear/detalle/editar"
```

---

## Task 16: Página de gestión de tipos de cliente

**Files:** Create `src/app/(app)/configuracion/tipos-de-cliente/page.tsx`

- [ ] **Step 1: Implementar (owner/admin; usa las Server Actions de tipos)**

`src/app/(app)/configuracion/tipos-de-cliente/page.tsx`:
```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listClientTypes } from "@/lib/clientes/queries";
import { canManageClientTypes } from "@/lib/clientes/permissions";
import { createClientTypeFormAction, updateClientTypeAction } from "@/app/(app)/clientes/actions";
import type { Role } from "@/lib/auth/roles";

export default async function TiposDeClientePage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  const { data: mem } = await sb.from("memberships").select("role").eq("user_id", user!.id).single();
  const role = (mem?.role ?? "vendedor") as Role;
  if (!canManageClientTypes(role)) redirect("/dashboard");

  const types = await listClientTypes(sb, { includeInactive: true });
  const inputCls = "h-9 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text)] outline-none focus:border-[#0e7490]";

  return (
    <div className="max-w-lg space-y-4 p-6">
      <h1 className="text-xl font-extrabold tracking-[-0.4px] text-[var(--text)]">Tipos de cliente</h1>

      <form action={createClientTypeFormAction} className="flex gap-2">
        <input name="name" placeholder="Nuevo tipo (ej. Mayorista)" className={`${inputCls} flex-1`} />
        <button className="rounded-[10px] bg-gradient-to-br from-[#0e7490] to-[#14b8a6] px-4 text-sm font-semibold text-white">Añadir</button>
      </form>

      <ul className="divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        {types.map((t) => (
          <li key={t.id} className="flex items-center gap-2 p-3">
            <form action={updateClientTypeAction} className="flex flex-1 items-center gap-2">
              <input type="hidden" name="id" value={t.id} />
              <input name="name" defaultValue={t.name} className={`${inputCls} flex-1`} />
              <button className="rounded-[10px] border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--text)]">Guardar</button>
            </form>
            <form action={updateClientTypeAction}>
              <input type="hidden" name="id" value={t.id} />
              <input type="hidden" name="active" value={t.active ? "false" : "true"} />
              <button className="rounded-[10px] border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--text-soft)]">
                {t.active ? "Desactivar" : "Activar"}
              </button>
            </form>
          </li>
        ))}
      </ul>
      <p className="text-xs text-[var(--text-soft)]">Los tipos inactivos no aparecen al crear clientes, pero se conservan en los clientes existentes.</p>
    </div>
  );
}
```
Nota: `createClientTypeFormAction` y `updateClientTypeAction` tienen firma de form-action `(fd: FormData) => Promise<void>`, así que se usan directamente en `<form action={...}>` sin cast. Los errores de validación en esta pantalla se ignoran silenciosamente (no hay estado inline); es aceptable para la gestión de tipos.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: build OK.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/configuracion/tipos-de-cliente/page.tsx"
git commit -m "feat(clientes): pantalla de gestión de tipos (owner/admin)"
```

---

## Task 17: Conectar el dashboard (KPI + widget)

**Files:** Modify `src/app/(app)/dashboard/page.tsx`

- [ ] **Step 1: Alimentar el KPI "Total de clientes" y añadir el widget "Clientes por tipo"**

En `src/app/(app)/dashboard/page.tsx`:
1. Añadir imports:
```tsx
import { clientsKpi, clientsByType } from "@/lib/clientes/queries";
```
2. Tras obtener `firstName`, cargar los datos (el `sb` ya existe en la página):
```tsx
  const [kpi, byType] = await Promise.all([clientsKpi(sb), clientsByType(sb)]);
  const totalClientes = kpi.total > 0
    ? { value: String(kpi.total), sub: `${kpi.newThisMonth} nuevos este mes` }
    : {};
```
3. Reemplazar las dos `KpiCard` de "Total de clientes" (la de la grilla móvil `label="Total de clientes"` y la de escritorio) para pasar los datos: en ambas, cambiar `<KpiCard icon={Users} label="Total de clientes" />` por:
```tsx
<KpiCard icon={Users} label="Total de clientes" value={totalClientes.value} sub={totalClientes.sub} />
```
(Si `kpi.total` es 0, `value` es `undefined` → la card mantiene su empty state.)

4. Añadir el widget "Clientes por tipo" al bloque de gráficos de escritorio. Debajo del `div` que contiene los dos `ChartCard` (Ventas de la semana / Estado del inventario), añadir:
```tsx
      {/* Escritorio: Clientes por tipo */}
      <div className="hidden lg:block">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="mb-3 text-sm font-bold text-[var(--text)]">Clientes por tipo</p>
          {byType.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--text-soft)]">Aún sin clientes registrados.</p>
          ) : (
            <ul className="space-y-2">
              {byType.map((t) => (
                <li key={t.typeId ?? "none"} className="flex items-center justify-between text-sm">
                  <span className="text-[var(--text)]">{t.name}</span>
                  <span className="font-semibold text-[var(--text)]">{t.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
```

- [ ] **Step 2: Verificar que `Users` esté importado**

En el import de `lucide-react` del dashboard ya está `Users` (se usa en el KPI). Si no, añadirlo.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build OK.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/dashboard/page.tsx"
git commit -m "feat(dashboard): Total de clientes real + widget Clientes por tipo"
```

---

## Task 18: Verificación final

- [ ] **Step 1: Toda la suite pasa**

Run: `npm test`
Expected: PASS (Plan 1/2 + schema, permissions, clientes integración).

- [ ] **Step 2: Build limpio**

Run: `npm run build`
Expected: sin errores.

- [ ] **Step 3: E2E manual** (`npm run dev`, `http://lvh.me:3000`)

Verificar con un tenant nuevo (owner):
- `/clientes` muestra empty state → "Nuevo cliente" → crear "Farmacia Sol" (empresa, tipo Mayorista) → redirige al detalle.
- En el form, "+ Tipo" crea "VIP" al vuelo y aparece en el selector.
- La lista muestra el cliente; buscar por "farmacia" lo filtra; filtro por tipo y por estado funcionan; paginación si hay >20.
- Detalle: Editar cambia datos; **Archivar** (visible por ser owner) lo archiva → aparece en filtro "Archivados"; Reactivar lo vuelve activo.
- `/configuracion/tipos-de-cliente` (owner): crear/renombrar/desactivar tipos.
- Dashboard: KPI "Total de clientes" muestra el conteo real + "N nuevos este mes"; widget "Clientes por tipo" lista los conteos.
- Role-gating: con un usuario `vendedor` (crear membership de prueba), el detalle NO muestra el botón Archivar y `/configuracion/tipos-de-cliente` redirige; con `cajero`, Clientes no aparece en el menú y `/clientes` no muestra datos.

- [ ] **Step 4: Commit de cierre (si hubo ajustes)**

```bash
git add -A && git commit -m "chore: módulo Clientes completo" || echo "sin cambios"
```

---

## Notas para planes posteriores

- Historial de compras y "por cobrar" en el detalle (Facturación), reemplazando esos empty states.
- Segmentos conductuales (Frecuentes/Nuevos) derivados de ventas.
- Import/export y de-duplicación de clientes; límite de crédito y condiciones de pago; índice trigram para búsqueda a escala.
- `service_role` no tiene grants en tablas públicas (gap conocido del Plan 2) — si se necesita seed/admin server-side, conceder grants o usar SQL directo.
