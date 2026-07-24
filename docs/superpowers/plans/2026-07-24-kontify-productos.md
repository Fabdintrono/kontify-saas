# Kontify — Módulo Productos (Plan 4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Catálogo de productos por empresa (CRUD + categorías y tasas de impuesto configurables + moneda por tenant), con role-gating por RLS y KPI/widget de dashboard, sin control de stock.

**Architecture:** Espeja exactamente el módulo Clientes (Plan 3): migraciones forward-only con RLS por rol, capa de datos testeable en `src/lib/productos/*` (schema Zod / permissions puras / queries RLS-scoped / mutations), Server Actions en `src/app/(app)/operaciones/productos/actions.ts`, UI con tabla/cards/toolbar/badge/form reutilizando los tokens visuales del Plan 2, pantallas de gestión en Configuración, y dashboard alimentado con degradación segura.

**Tech Stack:** Next.js (versión custom del repo — ver `AGENTS.md`), React Server Components + Server Actions, Supabase (Postgres + RLS), Zod, Vitest, Tailwind 4.

**Prerequisito de entorno:** Supabase local corriendo (`npx supabase start`). Los tests de integración y las migraciones se aplican contra esa instancia con `npx supabase db reset`.

**Referencia viva:** el módulo Clientes es la plantilla. Ante cualquier duda de estilo, mirar el archivo hermano en `*/clientes/*`. NO refactorizar Clientes.

---

## Estructura de archivos

**Migraciones (crear):**
- `supabase/migrations/0009_products_schema.sql` — enum `product_kind`, tablas `product_categories`/`tax_rates`/`products`, índices, `tenants.currency`.
- `supabase/migrations/0010_products_rls.sql` — políticas RLS + grants.
- `supabase/migrations/0011_seed_product_defaults.sql` — reemplaza `bootstrap_tenant` para sembrar "General", "IVA 16%" (default) y "Exento 0%".

**Capa de datos (crear):**
- `src/lib/productos/schema.ts` — Zod (producto, categoría, tasa) + tipos inferidos.
- `src/lib/productos/permissions.ts` — funciones puras de rol.
- `src/lib/productos/mutations.ts` — inserts/updates.
- `src/lib/productos/queries.ts` — lecturas RLS-scoped + KPI/widget con degradación segura + `getTenantCurrency`.
- `src/lib/format.ts` — helper `formatMoney`.

**Server Actions (crear):**
- `src/app/(app)/operaciones/productos/actions.ts`.

**UI (crear):**
- `src/components/productos/category-badge.tsx`
- `src/components/productos/products-table.tsx`
- `src/components/productos/product-row-card.tsx`
- `src/components/productos/products-toolbar.tsx`
- `src/components/productos/product-form.tsx`
- `src/app/(app)/operaciones/productos/page.tsx` (lista)
- `src/app/(app)/operaciones/productos/nuevo/page.tsx`
- `src/app/(app)/operaciones/productos/[id]/page.tsx` (detalle)
- `src/app/(app)/operaciones/productos/[id]/editar/page.tsx`
- `src/app/(app)/configuracion/categorias-de-producto/page.tsx`
- `src/app/(app)/configuracion/tasas-de-impuesto/page.tsx`

**Modificar:**
- `src/lib/nav.ts` — dos children nuevos en `CONFIG_SECTION`.
- `src/app/(app)/dashboard/page.tsx` — KPI Productos (móvil) + widget "Productos por categoría" (escritorio).

**Tests (crear):**
- `src/lib/productos/permissions.test.ts`
- `src/lib/productos/schema.test.ts`
- `src/lib/format.test.ts`
- `tests/productos.test.ts` (integración, requiere Supabase local).

---

## Task 1: Migración — schema

**Files:**
- Create: `supabase/migrations/0009_products_schema.sql`

- [ ] **Step 1: Escribir la migración de schema**

```sql
-- 0009_products_schema.sql
create type public.product_kind as enum ('good','service');

alter table public.tenants add column if not exists currency text not null default 'USD';

create table public.product_categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index product_categories_tenant_lname on public.product_categories (tenant_id, lower(name));
create index product_categories_tenant on public.product_categories (tenant_id);

create table public.tax_rates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  rate numeric(5,2) not null default 0,
  is_default boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index tax_rates_tenant_lname on public.tax_rates (tenant_id, lower(name));
create index tax_rates_tenant on public.tax_rates (tenant_id);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  kind public.product_kind not null,
  name text not null,
  sku text,
  description text,
  category_id uuid references public.product_categories(id) on delete set null,
  price numeric(14,2) not null default 0,
  cost numeric(14,2),
  tax_rate_id uuid references public.tax_rates(id) on delete set null,
  unit text not null default 'unidad',
  active boolean not null default true,
  created_branch_id uuid references public.branches(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_tenant on public.products (tenant_id);
create index products_tenant_active on public.products (tenant_id, active);
create index products_tenant_category on public.products (tenant_id, category_id);
create unique index products_tenant_sku on public.products (tenant_id, lower(sku)) where sku is not null;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/0009_products_schema.sql
git commit -m "feat(productos): migración de schema (enum, tablas, índices, tenants.currency)"
```

---

## Task 2: Migración — RLS + grants

**Files:**
- Create: `supabase/migrations/0010_products_rls.sql`

- [ ] **Step 1: Escribir la migración de RLS**

```sql
-- 0010_products_rls.sql
alter table public.product_categories enable row level security;
alter table public.tax_rates          enable row level security;
alter table public.products           enable row level security;

-- Catálogos auxiliares: SELECT para todo el tenant; crear al vuelo los roles CRUD;
-- renombrar/desactivar/marcar default solo owner/admin.
create policy product_categories_select on public.product_categories
  for select using (tenant_id = public.current_tenant_id());
create policy product_categories_insert on public.product_categories
  for insert with check (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin','administrativo','almacen'));
create policy product_categories_update on public.product_categories
  for update using (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin'))
  with check (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin'));

create policy tax_rates_select on public.tax_rates
  for select using (tenant_id = public.current_tenant_id());
create policy tax_rates_insert on public.tax_rates
  for insert with check (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin','administrativo','almacen'));
create policy tax_rates_update on public.tax_rates
  for update using (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin'))
  with check (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin'));

-- products: SELECT visible a todo el tenant (catálogo en lectura para vendedor/cajero);
-- INSERT/UPDATE solo owner/admin/administrativo/almacen; sin DELETE (soft-delete con active).
create policy products_select on public.products
  for select using (tenant_id = public.current_tenant_id());
create policy products_insert on public.products
  for insert with check (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin','administrativo','almacen'));
create policy products_update on public.products
  for update using (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin','administrativo','almacen'))
  with check (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin','administrativo','almacen'));

grant select, insert, update on public.product_categories to authenticated;
grant select, insert, update on public.tax_rates          to authenticated;
grant select, insert, update on public.products           to authenticated;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/0010_products_rls.sql
git commit -m "feat(productos): RLS + grants (SELECT amplio, escritura por rol)"
```

---

## Task 3: Migración — seed en bootstrap_tenant

**Files:**
- Create: `supabase/migrations/0011_seed_product_defaults.sql`

**Nota:** copia el cuerpo actual de `bootstrap_tenant` (migración `0008`) y añade el sembrado de categoría + tasas. No elimines el sembrado de `client_types` existente.

- [ ] **Step 1: Escribir la migración**

```sql
-- 0011_seed_product_defaults.sql
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
  insert into public.product_categories(tenant_id, name)
    values (v_tenant, 'General');
  insert into public.tax_rates(tenant_id, name, rate, is_default)
    values (v_tenant, 'IVA 16%', 16, true), (v_tenant, 'Exento 0%', 0, false);

  return v_tenant;
end; $$;

revoke all on function public.bootstrap_tenant(text,text,text) from public;
grant execute on function public.bootstrap_tenant(text,text,text) to authenticated;
```

- [ ] **Step 2: Aplicar todas las migraciones al Supabase local**

Run: `npx supabase db reset`
Expected: termina sin error; en el log aparecen `0009`, `0010`, `0011` aplicadas.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0011_seed_product_defaults.sql
git commit -m "feat(productos): siembra General + IVA 16% (default) + Exento 0% en bootstrap_tenant"
```

---

## Task 4: permissions.ts (TDD, puro)

**Files:**
- Create: `src/lib/productos/permissions.ts`
- Test: `src/lib/productos/permissions.test.ts`

- [ ] **Step 1: Escribir el test que falla**

```typescript
import { describe, it, expect } from "vitest";
import { canManageProducts, canArchiveProduct, canManageCategories, canManageTaxRates } from "./permissions";

describe("productos — permissions", () => {
  it("canManageProducts: owner/admin/administrativo/almacen sí; vendedor/cajero no", () => {
    expect(["owner", "admin", "administrativo", "almacen"].every(canManageProducts as any)).toBe(true);
    expect(canManageProducts("vendedor")).toBe(false);
    expect(canManageProducts("cajero")).toBe(false);
  });
  it("canArchiveProduct solo owner/admin", () => {
    expect(canArchiveProduct("owner")).toBe(true);
    expect(canArchiveProduct("admin")).toBe(true);
    expect(canArchiveProduct("administrativo")).toBe(false);
    expect(canArchiveProduct("almacen")).toBe(false);
  });
  it("canManageCategories / canManageTaxRates solo owner/admin", () => {
    expect(canManageCategories("admin")).toBe(true);
    expect(canManageCategories("almacen")).toBe(false);
    expect(canManageTaxRates("owner")).toBe(true);
    expect(canManageTaxRates("administrativo")).toBe(false);
  });
});
```

- [ ] **Step 2: Correr el test — debe fallar**

Run: `npx vitest run src/lib/productos/permissions.test.ts`
Expected: FAIL (no existe `./permissions`).

- [ ] **Step 3: Implementar**

```typescript
import type { Role } from "@/lib/auth/roles";

const CRUD_ROLES: Role[] = ["owner", "admin", "administrativo", "almacen"];

export const canManageProducts = (role: Role): boolean => CRUD_ROLES.includes(role);
export const canArchiveProduct = (role: Role): boolean => role === "owner" || role === "admin";
export const canManageCategories = (role: Role): boolean => role === "owner" || role === "admin";
export const canManageTaxRates = (role: Role): boolean => role === "owner" || role === "admin";
```

- [ ] **Step 4: Correr el test — debe pasar**

Run: `npx vitest run src/lib/productos/permissions.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/productos/permissions.ts src/lib/productos/permissions.test.ts
git commit -m "feat(productos): helpers de permisos con test"
```

---

## Task 5: schema.ts (TDD, Zod)

**Files:**
- Create: `src/lib/productos/schema.ts`
- Test: `src/lib/productos/schema.test.ts`

- [ ] **Step 1: Escribir el test que falla**

```typescript
import { describe, it, expect } from "vitest";
import { productCreateSchema, taxRateCreateSchema } from "./schema";

describe("productos — schema", () => {
  it("acepta un producto mínimo válido y castea números", () => {
    const r = productCreateSchema.safeParse({ kind: "good", name: "Café", price: "12.50" });
    expect(r.success).toBe(true);
    if (r.success) { expect(r.data.price).toBe(12.5); expect(r.data.unit).toBe("unidad"); }
  });
  it("rechaza name vacío y kind inválido", () => {
    expect(productCreateSchema.safeParse({ kind: "good", name: "", price: "1" }).success).toBe(false);
    expect(productCreateSchema.safeParse({ kind: "x", name: "A", price: "1" }).success).toBe(false);
  });
  it("rechaza price negativo y normaliza sku/category vacíos a null/undefined", () => {
    expect(productCreateSchema.safeParse({ kind: "good", name: "A", price: "-5" }).success).toBe(false);
    const r = productCreateSchema.safeParse({ kind: "service", name: "Corte", price: "0", sku: "", categoryId: "", taxRateId: "" });
    expect(r.success).toBe(true);
    if (r.success) { expect(r.data.sku).toBeUndefined(); expect(r.data.categoryId).toBeNull(); }
  });
  it("taxRate: rate fuera de 0–100 falla", () => {
    expect(taxRateCreateSchema.safeParse({ name: "IVA", rate: "16" }).success).toBe(true);
    expect(taxRateCreateSchema.safeParse({ name: "IVA", rate: "150" }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Correr el test — debe fallar**

Run: `npx vitest run src/lib/productos/schema.test.ts`
Expected: FAIL (no existe `./schema`).

- [ ] **Step 3: Implementar**

```typescript
import { z } from "zod";

export const PRODUCT_KINDS = ["good", "service"] as const;

const optStr = (max: number) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().max(max).optional());

const optId =
  z.preprocess((v) => (v === "" || v === "null" || v === undefined ? null : v),
    z.string().uuid().nullable().optional());

const reqNum =
  z.preprocess((v) => (v === "" || v === null || v === undefined ? 0 : v),
    z.coerce.number().min(0, "Debe ser ≥ 0"));

const optNum =
  z.preprocess((v) => (v === "" || v === null || v === undefined ? undefined : v),
    z.coerce.number().min(0, "Debe ser ≥ 0").optional());

const unitField =
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? "unidad" : v),
    z.string().trim().min(1).max(20).default("unidad"));

export const productCreateSchema = z.object({
  kind: z.enum(PRODUCT_KINDS, { message: "Tipo inválido" }),
  name: z.string().trim().min(1, "El nombre es obligatorio").max(120),
  sku: optStr(40),
  description: optStr(500),
  unit: unitField,
  categoryId: optId,
  price: reqNum,
  cost: optNum,
  taxRateId: optId,
});
export type ProductInput = z.infer<typeof productCreateSchema>;

export const productUpdateSchema = productCreateSchema; // el form de edición envía todos los campos

export const categoryCreateSchema = z.object({
  name: z.string().trim().min(1, "Nombre requerido").max(40),
});
export type CategoryInput = z.infer<typeof categoryCreateSchema>;

export const categoryUpdateSchema = z.object({
  name: z.string().trim().min(1).max(40).optional(),
  active: z.boolean().optional(),
});

export const taxRateCreateSchema = z.object({
  name: z.string().trim().min(1, "Nombre requerido").max(40),
  rate: z.coerce.number().min(0).max(100, "Entre 0 y 100"),
  isDefault: z.boolean().optional(),
});
export type TaxRateInput = z.infer<typeof taxRateCreateSchema>;

export const taxRateUpdateSchema = z.object({
  name: z.string().trim().min(1).max(40).optional(),
  rate: z.coerce.number().min(0).max(100).optional(),
  isDefault: z.boolean().optional(),
  active: z.boolean().optional(),
});
```

- [ ] **Step 4: Correr el test — debe pasar**

Run: `npx vitest run src/lib/productos/schema.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/productos/schema.ts src/lib/productos/schema.test.ts
git commit -m "feat(productos): esquemas Zod con test"
```

---

## Task 6: mutations.ts

**Files:**
- Create: `src/lib/productos/mutations.ts`

(Se ejercita en los tests de integración de la Task 8.)

- [ ] **Step 1: Implementar**

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProductInput, TaxRateInput } from "@/lib/productos/schema";

const productRow = (input: ProductInput) => ({
  kind: input.kind,
  name: input.name,
  sku: input.sku ?? null,
  description: input.description ?? null,
  category_id: input.categoryId ?? null,
  price: input.price,
  cost: input.cost ?? null,
  tax_rate_id: input.taxRateId ?? null,
  unit: input.unit,
});

export async function createProduct(
  sb: SupabaseClient, tenantId: string, userId: string, branchId: string | null, input: ProductInput,
): Promise<string> {
  const { data, error } = await sb.from("products")
    .insert({ tenant_id: tenantId, created_by: userId, created_branch_id: branchId, ...productRow(input) })
    .select("id").single();
  if (error) throw error;
  return data.id as string;
}

export async function updateProduct(sb: SupabaseClient, id: string, input: ProductInput): Promise<void> {
  const { error } = await sb.from("products")
    .update({ ...productRow(input), updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function archiveProduct(sb: SupabaseClient, id: string, active: boolean): Promise<void> {
  const { error } = await sb.from("products")
    .update({ active, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function createCategory(sb: SupabaseClient, tenantId: string, name: string) {
  const { data, error } = await sb.from("product_categories")
    .insert({ tenant_id: tenantId, name }).select("id, name").single();
  if (error) throw error;
  return data as { id: string; name: string };
}

export async function updateCategory(sb: SupabaseClient, id: string, patch: { name?: string; active?: boolean }) {
  const { error } = await sb.from("product_categories").update(patch).eq("id", id);
  if (error) throw error;
}

// Mantiene a-lo-sumo-un-default por tenant: si esta tasa es default, desmarca las demás primero.
export async function createTaxRate(sb: SupabaseClient, tenantId: string, input: TaxRateInput) {
  if (input.isDefault) await sb.from("tax_rates").update({ is_default: false }).eq("tenant_id", tenantId);
  const { data, error } = await sb.from("tax_rates")
    .insert({ tenant_id: tenantId, name: input.name, rate: input.rate, is_default: input.isDefault ?? false })
    .select("id, name").single();
  if (error) throw error;
  return data as { id: string; name: string };
}

export async function updateTaxRate(
  sb: SupabaseClient, tenantId: string, id: string,
  patch: { name?: string; rate?: number; isDefault?: boolean; active?: boolean },
) {
  if (patch.isDefault) await sb.from("tax_rates").update({ is_default: false }).eq("tenant_id", tenantId);
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.rate !== undefined) row.rate = patch.rate;
  if (patch.isDefault !== undefined) row.is_default = patch.isDefault;
  if (patch.active !== undefined) row.active = patch.active;
  const { error } = await sb.from("tax_rates").update(row).eq("id", id);
  if (error) throw error;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/productos/mutations.ts
git commit -m "feat(productos): capa de mutaciones (producto/categoría/tasa, default único)"
```

---

## Task 7: queries.ts

**Files:**
- Create: `src/lib/productos/queries.ts`

- [ ] **Step 1: Implementar**

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";

export type ProductListRow = {
  id: string; name: string; kind: "good" | "service";
  sku: string | null; price: number; active: boolean;
  categoryId: string | null; categoryName: string | null;
};
export type ProductStatus = "activos" | "archivados" | "todos";

// Neutraliza caracteres con significado en filtros PostgREST para evitar inyección en .or()
function sanitize(term: string): string {
  return term.replace(/[%,()*]/g, " ").trim();
}

export async function listProducts(sb: SupabaseClient, opts: {
  search?: string; categoryId?: string | null; kind?: "good" | "service" | null;
  status?: ProductStatus; page?: number; pageSize?: number;
} = {}): Promise<{ rows: ProductListRow[]; total: number; page: number; pageSize: number }> {
  const { search = "", categoryId = null, kind = null, status = "activos", page = 1, pageSize = 20 } = opts;
  let q = sb.from("products").select("id, name, kind, sku, price, active, category_id, product_categories(name)", { count: "exact" });
  if (status === "activos") q = q.eq("active", true);
  else if (status === "archivados") q = q.eq("active", false);
  if (categoryId) q = q.eq("category_id", categoryId);
  if (kind) q = q.eq("kind", kind);
  const s = sanitize(search);
  if (s) q = q.or(`name.ilike.%${s}%,sku.ilike.%${s}%`);
  const from = (page - 1) * pageSize;
  q = q.order("name").range(from, from + pageSize - 1);
  const { data, error, count } = await q;
  if (error) throw error;
  const rows: ProductListRow[] = (data ?? []).map((r: any) => ({
    id: r.id, name: r.name, kind: r.kind, sku: r.sku, price: Number(r.price), active: r.active,
    categoryId: r.category_id, categoryName: r.product_categories?.name ?? null,
  }));
  return { rows, total: count ?? 0, page, pageSize };
}

export async function getProduct(sb: SupabaseClient, id: string) {
  const { data, error } = await sb.from("products")
    .select("*, product_categories(name), tax_rates(name, rate)").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as any;
}

export async function listCategories(sb: SupabaseClient, opts: { includeInactive?: boolean } = {}) {
  let q = sb.from("product_categories").select("id, name, active").order("name");
  if (!opts.includeInactive) q = q.eq("active", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as { id: string; name: string; active: boolean }[];
}

export async function listTaxRates(sb: SupabaseClient, opts: { includeInactive?: boolean } = {}) {
  let q = sb.from("tax_rates").select("id, name, rate, is_default, active").order("name");
  if (!opts.includeInactive) q = q.eq("active", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id, name: r.name, rate: Number(r.rate), isDefault: r.is_default, active: r.active,
  })) as { id: string; name: string; rate: number; isDefault: boolean; active: boolean }[];
}

export async function getTenantCurrency(sb: SupabaseClient): Promise<string> {
  try {
    const { data, error } = await sb.from("tenants").select("currency").maybeSingle();
    if (error || !data) return "USD";
    return (data.currency as string) || "USD";
  } catch { return "USD"; }
}

// Consumidas por el dashboard: ante error/permiso denegado devuelven vacío, nunca lanzan.
export async function productsKpi(sb: SupabaseClient): Promise<{ total: number }> {
  try {
    const total = await sb.from("products").select("id", { count: "exact", head: true }).eq("active", true);
    if (total.error) return { total: 0 };
    return { total: total.count ?? 0 };
  } catch { return { total: 0 }; }
}

export async function productsByCategory(sb: SupabaseClient): Promise<{ categoryId: string | null; name: string; count: number }[]> {
  try {
    const { data, error } = await sb.from("products").select("category_id, product_categories(name)").eq("active", true);
    if (error || !data) return [];
    const map = new Map<string, { categoryId: string | null; name: string; count: number }>();
    for (const r of data as any[]) {
      const key = r.category_id ?? "none";
      const cur = map.get(key) ?? { categoryId: r.category_id ?? null, name: r.product_categories?.name ?? "Sin categoría", count: 0 };
      cur.count++; map.set(key, cur);
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
  } catch { return []; }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/productos/queries.ts
git commit -m "feat(productos): capa de queries (lista/detalle/catálogos/kpi/moneda) con degradación segura"
```

---

## Task 8: Tests de integración (RLS + CRUD)

**Files:**
- Create: `tests/productos.test.ts`

**Prerequisito:** Supabase local corriendo y migraciones aplicadas (`npx supabase db reset`).

- [ ] **Step 1: Escribir los tests**

```typescript
import { describe, it, expect } from "vitest";
import { newUserClient } from "./setup";
import { createProduct, archiveProduct, createTaxRate, updateTaxRate } from "@/lib/productos/mutations";
import { listProducts, listCategories, listTaxRates, productsKpi, productsByCategory } from "@/lib/productos/queries";

async function makeTenant(name: string) {
  const u = await newUserClient();
  const { data: tenantId } = await u.client.rpc("bootstrap_tenant", {
    p_name: name, p_slug: `${name}-${Date.now()}-${Math.random()}`, p_full_name: name,
  });
  return { ...u, tenantId: tenantId as string };
}

async function addMember(owner: Awaited<ReturnType<typeof makeTenant>>, role: string) {
  const u = await newUserClient();
  const { error } = await owner.client.from("memberships")
    .insert({ user_id: u.id, tenant_id: owner.tenantId, role });
  if (error) throw error;
  return u;
}

const base = (over: Partial<any> = {}) =>
  ({ kind: "good", name: "Producto", unit: "unidad", price: 10, sku: undefined,
     description: undefined, categoryId: null, cost: undefined, taxRateId: null, ...over });

describe("productos — seed y CRUD", () => {
  it("un tenant nuevo trae categoría General y tasas IVA 16% (default) + Exento 0%", async () => {
    const a = await makeTenant("seed");
    const cats = await listCategories(a.client);
    expect(cats.map((c) => c.name)).toEqual(["General"]);
    const taxes = await listTaxRates(a.client);
    expect(taxes.map((t) => t.name).sort()).toEqual(["Exento 0%", "IVA 16%"]);
    expect(taxes.find((t) => t.isDefault)?.name).toBe("IVA 16%");
  });

  it("crear, listar, archivar y contar", async () => {
    const a = await makeTenant("crud");
    const cats = await listCategories(a.client);
    const id = await createProduct(a.client, a.tenantId, a.id, null, base({ name: "Café", categoryId: cats[0].id, price: 12.5 }));
    expect(id).toBeTruthy();

    const activos = await listProducts(a.client, { status: "activos" });
    expect(activos.total).toBe(1);
    expect(activos.rows[0].categoryName).toBe("General");
    expect(activos.rows[0].price).toBe(12.5);

    expect((await productsKpi(a.client)).total).toBe(1);
    const byCat = await productsByCategory(a.client);
    expect(byCat.find((c) => c.categoryId === cats[0].id)?.count).toBe(1);

    await archiveProduct(a.client, id, false);
    expect((await listProducts(a.client, { status: "activos" })).total).toBe(0);
    expect((await listProducts(a.client, { status: "archivados" })).total).toBe(1);
  });

  it("búsqueda por nombre y SKU único por tenant", async () => {
    const a = await makeTenant("srch");
    await createProduct(a.client, a.tenantId, a.id, null, base({ name: "Filtro de aceite", sku: "F-100" }));
    await createProduct(a.client, a.tenantId, a.id, null, base({ name: "Bujía", sku: "B-200" }));
    const r = await listProducts(a.client, { search: "filtro" });
    expect(r.total).toBe(1);
    expect(r.rows[0].name).toBe("Filtro de aceite");

    // SKU duplicado en el mismo tenant → rechazado por índice único parcial
    await expect(createProduct(a.client, a.tenantId, a.id, null, base({ name: "Otro", sku: "F-100" }))).rejects.toBeTruthy();
  });

  it("marcar otra tasa como default desmarca la anterior", async () => {
    const a = await makeTenant("tax");
    await createTaxRate(a.client, a.tenantId, { name: "IVA reducido", rate: 8, isDefault: true });
    const taxes = await listTaxRates(a.client);
    const defaults = taxes.filter((t) => t.isDefault);
    expect(defaults).toHaveLength(1);
    expect(defaults[0].name).toBe("IVA reducido");
  });
});

describe("productos — RLS", () => {
  it("un tenant no ve productos de otro", async () => {
    const a = await makeTenant("aa");
    const b = await makeTenant("bb");
    await createProduct(a.client, a.tenantId, a.id, null, base({ name: "Producto A" }));
    const fromB = await listProducts(b.client, { status: "todos" });
    expect(fromB.total).toBe(0);
  });

  it("cajero y vendedor pueden LEER el catálogo pero no insertar", async () => {
    const a = await makeTenant("cc");
    await createProduct(a.client, a.tenantId, a.id, null, base({ name: "Visible" }));
    for (const role of ["cajero", "vendedor"]) {
      const m = await addMember(a, role);
      const { data: rows } = await m.client.from("products").select("*");
      expect(rows).toHaveLength(1); // RLS SELECT permite leer
      const { error } = await m.client.from("products")
        .insert({ tenant_id: a.tenantId, kind: "good", name: "X", price: 1 });
      expect(error).not.toBeNull(); // RLS INSERT niega
    }
  });

  it("almacen puede crear productos pero no renombrar una categoría", async () => {
    const a = await makeTenant("dd");
    const almacen = await addMember(a, "almacen");
    const cats = await listCategories(almacen.client);
    const pid = await createProduct(almacen.client, a.tenantId, almacen.id, null, base({ name: "Alm-prod", categoryId: cats[0].id }));
    expect(pid).toBeTruthy();

    const original = cats[0].name;
    await almacen.client.from("product_categories").update({ name: "Hackeado" }).eq("id", cats[0].id);
    const after = await listCategories(a.client);
    expect(after.find((c) => c.id === cats[0].id)?.name).toBe(original); // RLS impidió el cambio
  });
});
```

- [ ] **Step 2: Correr los tests — deben pasar**

Run: `npx vitest run tests/productos.test.ts`
Expected: PASS (todos). Si falla la siembra, verificar que `npx supabase db reset` aplicó `0011`.

- [ ] **Step 3: Commit**

```bash
git add tests/productos.test.ts
git commit -m "test(productos): integración RLS + CRUD + seed + SKU único + default tasa"
```

---

## Task 9: format.ts (TDD)

**Files:**
- Create: `src/lib/format.ts`
- Test: `src/lib/format.test.ts`

- [ ] **Step 1: Escribir el test que falla**

```typescript
import { describe, it, expect } from "vitest";
import { formatMoney } from "./format";

describe("formatMoney", () => {
  it("formatea con la moneda dada", () => {
    expect(formatMoney(1234.5, "USD")).toMatch(/1[.,]234[.,]5/);
  });
  it("cae a USD ante moneda inválida sin lanzar", () => {
    expect(() => formatMoney(10, "XXX-invalid")).not.toThrow();
    expect(formatMoney(null, "USD")).toBe("—");
  });
});
```

- [ ] **Step 2: Correr el test — debe fallar**

Run: `npx vitest run src/lib/format.test.ts`
Expected: FAIL (no existe `./format`).

- [ ] **Step 3: Implementar**

```typescript
export function formatMoney(amount: number | null | undefined, currency = "USD"): string {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) return "—";
  try {
    return new Intl.NumberFormat("es", { style: "currency", currency, minimumFractionDigits: 2 }).format(Number(amount));
  } catch {
    return new Intl.NumberFormat("es", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(Number(amount));
  }
}
```

- [ ] **Step 4: Correr el test — debe pasar**

Run: `npx vitest run src/lib/format.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/format.ts src/lib/format.test.ts
git commit -m "feat: helper formatMoney con test"
```

---

## Task 10: Server Actions

**Files:**
- Create: `src/app/(app)/operaciones/productos/actions.ts`

- [ ] **Step 1: Implementar**

```typescript
"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient as serverSupabase } from "@/lib/supabase/server";
import {
  productCreateSchema, categoryCreateSchema, categoryUpdateSchema,
  taxRateCreateSchema, taxRateUpdateSchema,
} from "@/lib/productos/schema";
import { canManageProducts, canArchiveProduct, canManageCategories, canManageTaxRates } from "@/lib/productos/permissions";
import * as m from "@/lib/productos/mutations";
import type { Role } from "@/lib/auth/roles";

export type FormState = { ok: boolean; error?: string; fieldErrors?: Record<string, string> };
const LIST = "/operaciones/productos";
const CATS = "/configuracion/categorias-de-producto";
const TAXES = "/configuracion/tasas-de-impuesto";

function zodErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of err.issues) { const k = String(i.path[0] ?? "_"); if (!out[k]) out[k] = i.message; }
  return out;
}

const productFields = (fd: FormData) => ({
  kind: fd.get("kind"), name: fd.get("name"), sku: fd.get("sku"), description: fd.get("description"),
  unit: fd.get("unit"), categoryId: fd.get("categoryId"), price: fd.get("price"),
  cost: fd.get("cost"), taxRateId: fd.get("taxRateId"),
});

async function ctx() {
  const sb = await serverSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const { data: mem } = await sb.from("memberships").select("role").eq("user_id", user.id).single();
  const { data: tenantId } = await sb.rpc("current_tenant_id");
  return { sb, userId: user.id, role: (mem?.role ?? "vendedor") as Role, tenantId: tenantId as string };
}

export async function createProductAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { sb, userId, role, tenantId } = await ctx();
  if (!canManageProducts(role)) return { ok: false, error: "Sin permiso" };
  const parsed = productCreateSchema.safeParse(productFields(fd));
  if (!parsed.success) return { ok: false, fieldErrors: zodErrors(parsed.error) };
  let id: string;
  try { id = await m.createProduct(sb, tenantId, userId, null, parsed.data); }
  catch (e) { return { ok: false, error: (e as Error).message }; }
  revalidatePath(LIST);
  redirect(`${LIST}/${id}`);
}

export async function updateProductAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { sb, role } = await ctx();
  if (!canManageProducts(role)) return { ok: false, error: "Sin permiso" };
  const id = String(fd.get("id") ?? "");
  const parsed = productCreateSchema.safeParse(productFields(fd));
  if (!parsed.success) return { ok: false, fieldErrors: zodErrors(parsed.error) };
  try { await m.updateProduct(sb, id, parsed.data); }
  catch (e) { return { ok: false, error: (e as Error).message }; }
  revalidatePath(`${LIST}/${id}`);
  redirect(`${LIST}/${id}`);
}

export async function archiveProductAction(fd: FormData): Promise<void> {
  const { sb, role } = await ctx();
  if (!canArchiveProduct(role)) return; // botón oculto para no-owner/admin; defensa extra
  const id = String(fd.get("id") ?? "");
  const active = fd.get("active") === "true";
  await m.archiveProduct(sb, id, active);
  revalidatePath(LIST);
  revalidatePath(`${LIST}/${id}`);
}

// Crear categoría al vuelo desde el formulario de producto (llamada directa desde client component).
export async function createCategoryNamed(
  name: string,
): Promise<{ ok: boolean; category?: { id: string; name: string }; error?: string }> {
  const { sb, role, tenantId } = await ctx();
  if (!canManageProducts(role)) return { ok: false, error: "Sin permiso" };
  const parsed = categoryCreateSchema.safeParse({ name });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };
  try {
    const c = await m.createCategory(sb, tenantId, parsed.data.name);
    revalidatePath(LIST);
    return { ok: true, category: c };
  } catch (e) { return { ok: false, error: (e as Error).message }; }
}

export async function createCategoryFormAction(fd: FormData): Promise<void> {
  const { sb, role, tenantId } = await ctx();
  if (!canManageCategories(role)) return;
  const parsed = categoryCreateSchema.safeParse({ name: fd.get("name") });
  if (!parsed.success) return;
  try { await m.createCategory(sb, tenantId, parsed.data.name); } catch { return; }
  revalidatePath(CATS);
}

export async function updateCategoryAction(fd: FormData): Promise<void> {
  const { sb, role } = await ctx();
  if (!canManageCategories(role)) return;
  const id = String(fd.get("id") ?? "");
  const patch: { name?: string; active?: boolean } = {};
  if (fd.has("name")) patch.name = String(fd.get("name"));
  if (fd.has("active")) patch.active = fd.get("active") === "true";
  const parsed = categoryUpdateSchema.safeParse(patch);
  if (!parsed.success) return;
  await m.updateCategory(sb, id, parsed.data);
  revalidatePath(CATS);
}

export async function createTaxRateFormAction(fd: FormData): Promise<void> {
  const { sb, role, tenantId } = await ctx();
  if (!canManageTaxRates(role)) return;
  const parsed = taxRateCreateSchema.safeParse({
    name: fd.get("name"), rate: fd.get("rate"), isDefault: fd.get("isDefault") === "true",
  });
  if (!parsed.success) return;
  try { await m.createTaxRate(sb, tenantId, parsed.data); } catch { return; }
  revalidatePath(TAXES);
}

export async function updateTaxRateAction(fd: FormData): Promise<void> {
  const { sb, role, tenantId } = await ctx();
  if (!canManageTaxRates(role)) return;
  const id = String(fd.get("id") ?? "");
  const patch: { name?: string; rate?: number; isDefault?: boolean; active?: boolean } = {};
  if (fd.has("name")) patch.name = String(fd.get("name"));
  if (fd.has("rate")) patch.rate = Number(fd.get("rate"));
  if (fd.has("isDefault")) patch.isDefault = fd.get("isDefault") === "true";
  if (fd.has("active")) patch.active = fd.get("active") === "true";
  const parsed = taxRateUpdateSchema.safeParse(patch);
  if (!parsed.success) return;
  await m.updateTaxRate(sb, tenantId, id, parsed.data);
  revalidatePath(TAXES);
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos en `actions.ts`.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/operaciones/productos/actions.ts"
git commit -m "feat(productos): Server Actions (Zod + rol + revalidate)"
```

---

## Task 11: Componentes de lista (badge, table, row-card, toolbar)

**Files:**
- Create: `src/components/productos/category-badge.tsx`
- Create: `src/components/productos/products-table.tsx`
- Create: `src/components/productos/product-row-card.tsx`
- Create: `src/components/productos/products-toolbar.tsx`

- [ ] **Step 1: category-badge.tsx**

```tsx
export function CategoryBadge({ name }: { name: string | null }) {
  if (!name) return <span className="text-xs text-[var(--text-soft)]">—</span>;
  return (
    <span className="inline-flex items-center rounded-full bg-[#0e7490]/10 px-2 py-0.5 text-xs font-medium text-[#0e7490] dark:text-[#5eead4]">
      {name}
    </span>
  );
}
```

- [ ] **Step 2: products-table.tsx**

```tsx
import Link from "next/link";
import type { ProductListRow } from "@/lib/productos/queries";
import { formatMoney } from "@/lib/format";
import { CategoryBadge } from "./category-badge";

export function ProductsTable({ rows, currency }: { rows: ProductListRow[]; currency: string }) {
  return (
    <table className="hidden w-full text-sm lg:table">
      <thead>
        <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--text-soft)]">
          <th className="py-2 font-medium">Nombre</th><th className="font-medium">SKU</th>
          <th className="font-medium">Categoría</th><th className="font-medium">Precio</th><th className="font-medium">Estado</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className="border-b border-[var(--border)] hover:bg-[var(--bg)]">
            <td className="py-2.5">
              <Link href={`/operaciones/productos/${r.id}`} className="font-medium text-[var(--text)] hover:text-[#0e7490]">{r.name}</Link>
              <span className="ml-2 text-xs text-[var(--text-soft)]">{r.kind === "service" ? "Servicio" : "Bien"}</span>
            </td>
            <td className="text-[var(--text-soft)]">{r.sku || "—"}</td>
            <td><CategoryBadge name={r.categoryName} /></td>
            <td className="text-[var(--text)]">{formatMoney(r.price, currency)}</td>
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

- [ ] **Step 3: product-row-card.tsx**

```tsx
import Link from "next/link";
import type { ProductListRow } from "@/lib/productos/queries";
import { formatMoney } from "@/lib/format";
import { CategoryBadge } from "./category-badge";

export function ProductRowCard({ r, currency }: { r: ProductListRow; currency: string }) {
  return (
    <Link href={`/operaciones/productos/${r.id}`}
      className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 lg:hidden">
      <div className="min-w-0">
        <p className="truncate font-medium text-[var(--text)]">{r.name}</p>
        <p className="truncate text-xs text-[var(--text-soft)]">{r.sku || "—"} · {formatMoney(r.price, currency)}</p>
      </div>
      <div className="flex flex-none items-center gap-2">
        <CategoryBadge name={r.categoryName} />
        {!r.active && <span className="text-xs text-[var(--text-soft)]">Archivado</span>}
      </div>
    </Link>
  );
}
```

- [ ] **Step 4: products-toolbar.tsx**

```tsx
"use client";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

export function ProductsToolbar({ categories }: { categories: { id: string; name: string }[] }) {
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
        <input defaultValue={sp.get("q") ?? ""} placeholder="Buscar por nombre o SKU…"
          onKeyDown={(e) => { if (e.key === "Enter") setParam("q", (e.target as HTMLInputElement).value); }}
          className="w-full bg-transparent text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-soft)]" />
      </div>
      <select className={sel} defaultValue={sp.get("category") ?? ""} onChange={(e) => setParam("category", e.target.value)}>
        <option value="">Todas las categorías</option>
        {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <select className={sel} defaultValue={sp.get("kind") ?? ""} onChange={(e) => setParam("kind", e.target.value)}>
        <option value="">Bien y servicio</option>
        <option value="good">Bien</option>
        <option value="service">Servicio</option>
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

- [ ] **Step 5: Commit**

```bash
git add src/components/productos/category-badge.tsx src/components/productos/products-table.tsx src/components/productos/product-row-card.tsx src/components/productos/products-toolbar.tsx
git commit -m "feat(productos): componentes de lista (badge, table, card, toolbar)"
```

---

## Task 12: Formulario compartido crear/editar

**Files:**
- Create: `src/components/productos/product-form.tsx`

- [ ] **Step 1: Implementar**

```tsx
"use client";
import { useActionState, useState } from "react";
import { createCategoryNamed, type FormState } from "@/app/(app)/operaciones/productos/actions";

type Category = { id: string; name: string };
type TaxRate = { id: string; name: string; isDefault: boolean };
type Values = {
  id?: string; kind?: "good" | "service"; name?: string; sku?: string; description?: string;
  unit?: string; categoryId?: string | null; price?: string; cost?: string; taxRateId?: string | null;
};

const initial: FormState = { ok: false };
const inputCls = "w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[#0e7490]";
const labelCls = "mb-1 block text-xs font-medium text-[var(--text-soft)]";

export function ProductForm({ action, categories, taxRates, values = {}, submitLabel }: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  categories: Category[]; taxRates: TaxRate[]; values?: Values; submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, initial);
  const [localCats, setLocalCats] = useState<Category[]>(categories);
  const [categoryId, setCategoryId] = useState<string>(values.categoryId ?? "");
  const defaultTax = values.taxRateId ?? taxRates.find((t) => t.isDefault)?.id ?? "";
  const [adding, setAdding] = useState(false);
  const [newCat, setNewCat] = useState("");
  const [catErr, setCatErr] = useState("");
  const [creating, setCreating] = useState(false);
  const err = (k: string) => state.fieldErrors?.[k];

  async function addCategory() {
    setCreating(true); setCatErr("");
    const r = await createCategoryNamed(newCat);
    setCreating(false);
    if (!r.ok || !r.category) { setCatErr(r.error ?? "No se pudo crear"); return; }
    setLocalCats((prev) => [...prev, r.category!].sort((a, b) => a.name.localeCompare(b.name)));
    setCategoryId(r.category.id); setNewCat(""); setAdding(false);
  }

  return (
    <form action={formAction} className="max-w-xl space-y-3">
      {values.id && <input type="hidden" name="id" defaultValue={values.id} />}
      <input type="hidden" name="categoryId" value={categoryId} />
      <div>
        <label className={labelCls}>Tipo</label>
        <select name="kind" defaultValue={values.kind ?? "good"} className={inputCls}>
          <option value="good">Bien</option>
          <option value="service">Servicio</option>
        </select>
      </div>
      <div>
        <label className={labelCls}>Nombre *</label>
        <input name="name" defaultValue={values.name ?? ""} className={inputCls} />
        {err("name") && <p className="mt-1 text-xs text-[#dc2626]">{err("name")}</p>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={labelCls}>SKU / código</label><input name="sku" defaultValue={values.sku ?? ""} className={inputCls} /></div>
        <div><label className={labelCls}>Unidad</label><input name="unit" defaultValue={values.unit ?? "unidad"} className={inputCls} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Precio *</label>
          <input name="price" type="number" step="0.01" min="0" defaultValue={values.price ?? "0"} className={inputCls} />
          {err("price") && <p className="mt-1 text-xs text-[#dc2626]">{err("price")}</p>}
        </div>
        <div>
          <label className={labelCls}>Costo</label>
          <input name="cost" type="number" step="0.01" min="0" defaultValue={values.cost ?? ""} className={inputCls} />
          {err("cost") && <p className="mt-1 text-xs text-[#dc2626]">{err("cost")}</p>}
        </div>
      </div>
      <div>
        <label className={labelCls}>Impuesto</label>
        <select name="taxRateId" defaultValue={defaultTax} className={inputCls}>
          <option value="">Sin impuesto</option>
          {taxRates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>
      <div>
        <label className={labelCls}>Categoría</label>
        <div className="flex gap-2">
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputCls}>
            <option value="">Sin categoría</option>
            {localCats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button type="button" onClick={() => setAdding((v) => !v)}
            className="flex-none rounded-[10px] border border-[var(--border)] px-3 text-sm text-[var(--text)]">+ Categoría</button>
        </div>
        {adding && (
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-dashed border-[var(--border)] p-2">
            <input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="Nueva categoría (ej. Repuestos)" className={inputCls} />
            <button type="button" onClick={addCategory} disabled={creating || !newCat.trim()}
              className="flex-none rounded-[10px] bg-[#0e7490] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">
              {creating ? "…" : "Crear"}
            </button>
          </div>
        )}
        {catErr && <p className="mt-1 text-xs text-[#dc2626]">{catErr}</p>}
      </div>
      <div><label className={labelCls}>Descripción</label><textarea name="description" defaultValue={values.description ?? ""} rows={3} className={inputCls} /></div>

      {state.error && <p className="text-sm text-[#dc2626]">{state.error}</p>}
      <button disabled={pending} className="rounded-[10px] bg-gradient-to-br from-[#0e7490] to-[#14b8a6] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
        {pending ? "Guardando…" : submitLabel}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/productos/product-form.tsx
git commit -m "feat(productos): formulario compartido crear/editar + crear categoría al vuelo"
```

---

## Task 13: Páginas lista / nuevo / editar

**Files:**
- Create: `src/app/(app)/operaciones/productos/page.tsx`
- Create: `src/app/(app)/operaciones/productos/nuevo/page.tsx`
- Create: `src/app/(app)/operaciones/productos/[id]/editar/page.tsx`

- [ ] **Step 1: Lista (`page.tsx`)**

```tsx
import Link from "next/link";
import { Plus, Package } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { listProducts, listCategories, getTenantCurrency, type ProductStatus } from "@/lib/productos/queries";
import { canManageProducts } from "@/lib/productos/permissions";
import { ProductsToolbar } from "@/components/productos/products-toolbar";
import { ProductsTable } from "@/components/productos/products-table";
import { ProductRowCard } from "@/components/productos/product-row-card";
import { EmptyState } from "@/components/shared/empty-state";
import type { Role } from "@/lib/auth/roles";

export default async function ProductosPage({ searchParams }: {
  searchParams: Promise<{ q?: string; category?: string; kind?: string; status?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  const { data: mem } = await sb.from("memberships").select("role").eq("user_id", user!.id).single();
  const role = (mem?.role ?? "vendedor") as Role;
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const status = (["activos", "archivados", "todos"].includes(sp.status ?? "") ? sp.status : "activos") as ProductStatus;
  const kind = (["good", "service"].includes(sp.kind ?? "") ? sp.kind : null) as "good" | "service" | null;

  const [categories, currency, list] = await Promise.all([
    listCategories(sb),
    getTenantCurrency(sb),
    listProducts(sb, { search: sp.q ?? "", categoryId: sp.category || null, kind, status, page }),
  ]);
  const pages = Math.max(1, Math.ceil(list.total / list.pageSize));

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold tracking-[-0.4px] text-[var(--text)]">Productos</h1>
        {canManageProducts(role) && (
          <Link href="/operaciones/productos/nuevo"
            className="flex items-center gap-1.5 rounded-[10px] bg-gradient-to-br from-[#0e7490] to-[#14b8a6] px-3 py-2 text-sm font-semibold text-white">
            <Plus className="h-4 w-4" strokeWidth={2.5} /> Nuevo producto
          </Link>
        )}
      </div>

      <ProductsToolbar categories={categories} />

      {list.rows.length === 0 ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
          <EmptyState icon={Package} title="Aún no tienes productos" hint="Crea el primero con “Nuevo producto”." />
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-2 lg:p-4">
          <ProductsTable rows={list.rows} currency={currency} />
          <div className="space-y-2 lg:hidden">{list.rows.map((r) => <ProductRowCard key={r.id} r={r} currency={currency} />)}</div>
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
  if (sp.q) params.set("q", sp.q); if (sp.category) params.set("category", sp.category);
  if (sp.kind) params.set("kind", sp.kind); if (sp.status) params.set("status", sp.status);
  params.set("page", String(page));
  return <Link href={`/operaciones/productos?${params.toString()}`} className="rounded px-2 text-[var(--text)] hover:bg-[var(--bg)]">{children}</Link>;
}
```

- [ ] **Step 2: Nuevo (`nuevo/page.tsx`)**

```tsx
import { createClient } from "@/lib/supabase/server";
import { listCategories, listTaxRates } from "@/lib/productos/queries";
import { createProductAction } from "@/app/(app)/operaciones/productos/actions";
import { ProductForm } from "@/components/productos/product-form";

export default async function NuevoProductoPage() {
  const sb = await createClient();
  const [categories, taxRates] = await Promise.all([listCategories(sb), listTaxRates(sb)]);
  return (
    <div className="p-6">
      <h1 className="mb-4 text-xl font-extrabold tracking-[-0.4px] text-[var(--text)]">Nuevo producto</h1>
      <ProductForm action={createProductAction} categories={categories} taxRates={taxRates} submitLabel="Crear producto" />
    </div>
  );
}
```

- [ ] **Step 3: Editar (`[id]/editar/page.tsx`)**

```tsx
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProduct, listCategories, listTaxRates } from "@/lib/productos/queries";
import { updateProductAction } from "@/app/(app)/operaciones/productos/actions";
import { ProductForm } from "@/components/productos/product-form";

export default async function EditarProductoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createClient();
  const [p, categories, taxRates] = await Promise.all([getProduct(sb, id), listCategories(sb), listTaxRates(sb)]);
  if (!p) notFound();
  return (
    <div className="p-6">
      <h1 className="mb-4 text-xl font-extrabold tracking-[-0.4px] text-[var(--text)]">Editar producto</h1>
      <ProductForm action={updateProductAction} categories={categories} taxRates={taxRates} submitLabel="Guardar cambios"
        values={{ id: p.id, kind: p.kind, name: p.name, sku: p.sku ?? "", description: p.description ?? "",
          unit: p.unit ?? "unidad", categoryId: p.category_id ?? "",
          price: p.price != null ? String(p.price) : "0", cost: p.cost != null ? String(p.cost) : "",
          taxRateId: p.tax_rate_id ?? "" }} />
    </div>
  );
}
```

- [ ] **Step 4: Verificar build de tipos**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/operaciones/productos/page.tsx" "src/app/(app)/operaciones/productos/nuevo/page.tsx" "src/app/(app)/operaciones/productos/[id]/editar/page.tsx"
git commit -m "feat(productos): páginas lista/nuevo/editar"
```

---

## Task 14: Página de detalle

**Files:**
- Create: `src/app/(app)/operaciones/productos/[id]/page.tsx`

- [ ] **Step 1: Implementar**

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, Boxes } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getProduct, getTenantCurrency } from "@/lib/productos/queries";
import { canManageProducts, canArchiveProduct } from "@/lib/productos/permissions";
import { archiveProductAction } from "@/app/(app)/operaciones/productos/actions";
import { EmptyState } from "@/components/shared/empty-state";
import { CategoryBadge } from "@/components/productos/category-badge";
import { formatMoney } from "@/lib/format";
import type { Role } from "@/lib/auth/roles";

export default async function ProductoDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createClient();
  const [p, currency] = await Promise.all([getProduct(sb, id), getTenantCurrency(sb)]);
  if (!p) notFound();
  const { data: { user } } = await sb.auth.getUser();
  const { data: mem } = await sb.from("memberships").select("role").eq("user_id", user!.id).single();
  const role = (mem?.role ?? "vendedor") as Role;

  const margin = p.cost != null && p.price != null ? Number(p.price) - Number(p.cost) : null;
  const field = (label: string, value: string | null) => (
    <div><p className="text-xs text-[var(--text-soft)]">{label}</p><p className="text-sm text-[var(--text)]">{value || "—"}</p></div>
  );

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-extrabold tracking-[-0.4px] text-[var(--text)]">{p.name}</h1>
          <CategoryBadge name={p.product_categories?.name ?? null} />
          {!p.active && <span className="rounded-full bg-[var(--bg)] px-2 py-0.5 text-xs text-[var(--text-soft)]">Archivado</span>}
        </div>
        <div className="flex items-center gap-2">
          {canManageProducts(role) && (
            <Link href={`/operaciones/productos/${p.id}/editar`}
              className="flex items-center gap-1.5 rounded-[10px] border border-[var(--border)] px-3 py-2 text-sm text-[var(--text)]">
              <Pencil className="h-4 w-4" /> Editar
            </Link>
          )}
          {canArchiveProduct(role) && (
            <form action={archiveProductAction}>
              <input type="hidden" name="id" value={p.id} />
              <input type="hidden" name="active" value={p.active ? "false" : "true"} />
              <button className="rounded-[10px] border border-[var(--border)] px-3 py-2 text-sm text-[var(--text)]">
                {p.active ? "Archivar" : "Reactivar"}
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="grid gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:grid-cols-2">
        {field("Tipo", p.kind === "service" ? "Servicio" : "Bien")}
        {field("SKU / código", p.sku)}
        {field("Precio", formatMoney(p.price, currency))}
        {field("Costo", p.cost != null ? formatMoney(p.cost, currency) : null)}
        {field("Margen", margin != null ? formatMoney(margin, currency) : null)}
        {field("Impuesto", p.tax_rates ? `${p.tax_rates.name} (${Number(p.tax_rates.rate)}%)` : null)}
        {field("Unidad", p.unit)}
        <div className="sm:col-span-2">{field("Descripción", p.description)}</div>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        <EmptyState icon={Boxes} title="Existencias / Movimientos" hint="Llega con el módulo de Inventario." />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add "src/app/(app)/operaciones/productos/[id]/page.tsx"
git commit -m "feat(productos): página de detalle con margen y empty state de inventario"
```

---

## Task 15: Pantallas de gestión (categorías + tasas) y nav

**Files:**
- Create: `src/app/(app)/configuracion/categorias-de-producto/page.tsx`
- Create: `src/app/(app)/configuracion/tasas-de-impuesto/page.tsx`
- Modify: `src/lib/nav.ts` (añadir dos children en `CONFIG_SECTION`)

- [ ] **Step 1: Categorías (`categorias-de-producto/page.tsx`)**

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listCategories } from "@/lib/productos/queries";
import { canManageCategories } from "@/lib/productos/permissions";
import { createCategoryFormAction, updateCategoryAction } from "@/app/(app)/operaciones/productos/actions";
import type { Role } from "@/lib/auth/roles";

export default async function CategoriasDeProductoPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  const { data: mem } = await sb.from("memberships").select("role").eq("user_id", user!.id).single();
  const role = (mem?.role ?? "vendedor") as Role;
  if (!canManageCategories(role)) redirect("/dashboard");

  const categories = await listCategories(sb, { includeInactive: true });
  const inputCls = "h-9 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text)] outline-none focus:border-[#0e7490]";

  return (
    <div className="max-w-lg space-y-4 p-6">
      <h1 className="text-xl font-extrabold tracking-[-0.4px] text-[var(--text)]">Categorías de producto</h1>

      <form action={createCategoryFormAction} className="flex gap-2">
        <input name="name" placeholder="Nueva categoría (ej. Repuestos)" className={`${inputCls} flex-1`} />
        <button className="rounded-[10px] bg-gradient-to-br from-[#0e7490] to-[#14b8a6] px-4 text-sm font-semibold text-white">Añadir</button>
      </form>

      <ul className="divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        {categories.map((c) => (
          <li key={c.id} className="flex items-center gap-2 p-3">
            <form action={updateCategoryAction} className="flex flex-1 items-center gap-2">
              <input type="hidden" name="id" value={c.id} />
              <input name="name" defaultValue={c.name} className={`${inputCls} flex-1`} />
              <button className="rounded-[10px] border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--text)]">Guardar</button>
            </form>
            <form action={updateCategoryAction}>
              <input type="hidden" name="id" value={c.id} />
              <input type="hidden" name="active" value={c.active ? "false" : "true"} />
              <button className="rounded-[10px] border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--text-soft)]">
                {c.active ? "Desactivar" : "Activar"}
              </button>
            </form>
          </li>
        ))}
      </ul>
      <p className="text-xs text-[var(--text-soft)]">Las categorías inactivas no aparecen al crear productos, pero se conservan en los existentes.</p>
    </div>
  );
}
```

- [ ] **Step 2: Tasas (`tasas-de-impuesto/page.tsx`)**

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listTaxRates } from "@/lib/productos/queries";
import { canManageTaxRates } from "@/lib/productos/permissions";
import { createTaxRateFormAction, updateTaxRateAction } from "@/app/(app)/operaciones/productos/actions";
import type { Role } from "@/lib/auth/roles";

export default async function TasasDeImpuestoPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  const { data: mem } = await sb.from("memberships").select("role").eq("user_id", user!.id).single();
  const role = (mem?.role ?? "vendedor") as Role;
  if (!canManageTaxRates(role)) redirect("/dashboard");

  const rates = await listTaxRates(sb, { includeInactive: true });
  const inputCls = "h-9 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text)] outline-none focus:border-[#0e7490]";

  return (
    <div className="max-w-2xl space-y-4 p-6">
      <h1 className="text-xl font-extrabold tracking-[-0.4px] text-[var(--text)]">Tasas de impuesto</h1>

      <form action={createTaxRateFormAction} className="flex flex-wrap items-center gap-2">
        <input name="name" placeholder="Nombre (ej. IVA 16%)" className={`${inputCls} flex-1`} />
        <input name="rate" type="number" step="0.01" min="0" max="100" placeholder="%" className={`${inputCls} w-24`} />
        <label className="flex items-center gap-1 text-sm text-[var(--text-soft)]">
          <input type="checkbox" name="isDefault" value="true" /> Predet.
        </label>
        <button className="rounded-[10px] bg-gradient-to-br from-[#0e7490] to-[#14b8a6] px-4 text-sm font-semibold text-white">Añadir</button>
      </form>

      <ul className="divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        {rates.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center gap-2 p-3">
            <form action={updateTaxRateAction} className="flex flex-1 flex-wrap items-center gap-2">
              <input type="hidden" name="id" value={t.id} />
              <input name="name" defaultValue={t.name} className={`${inputCls} flex-1`} />
              <input name="rate" type="number" step="0.01" min="0" max="100" defaultValue={t.rate} className={`${inputCls} w-24`} />
              {t.isDefault
                ? <span className="rounded-full bg-[#0e7490]/10 px-2 py-0.5 text-xs font-medium text-[#0e7490] dark:text-[#5eead4]">Predet.</span>
                : <button name="isDefault" value="true" className="rounded-[10px] border border-[var(--border)] px-2 py-1.5 text-xs text-[var(--text-soft)]">Hacer predet.</button>}
              <button className="rounded-[10px] border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--text)]">Guardar</button>
            </form>
            <form action={updateTaxRateAction}>
              <input type="hidden" name="id" value={t.id} />
              <input type="hidden" name="active" value={t.active ? "false" : "true"} />
              <button className="rounded-[10px] border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--text-soft)]">
                {t.active ? "Desactivar" : "Activar"}
              </button>
            </form>
          </li>
        ))}
      </ul>
      <p className="text-xs text-[var(--text-soft)]">La tasa predeterminada se preselecciona al crear productos. Solo puede haber una.</p>
    </div>
  );
}
```

- [ ] **Step 3: Añadir los children al nav**

En `src/lib/nav.ts`, dentro de `CONFIG_SECTION.children`, insertar debajo del item "Tipos de cliente":

```typescript
    { label: "Categorías de producto", href: "/configuracion/categorias-de-producto", icon: Tags, resource: "billing" },
    { label: "Tasas de impuesto", href: "/configuracion/tasas-de-impuesto", icon: Percent, resource: "billing" },
```

(El icono `Percent` ya está importado en `nav.ts`. `Tags` también.)

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/configuracion/categorias-de-producto/page.tsx" "src/app/(app)/configuracion/tasas-de-impuesto/page.tsx" src/lib/nav.ts
git commit -m "feat(productos): pantallas de gestión (categorías + tasas) y nav de configuración"
```

---

## Task 16: Dashboard — KPI Productos + widget "Productos por categoría"

**Files:**
- Modify: `src/app/(app)/dashboard/page.tsx`

**Decisión de diseño (intencional):** para no romper la grilla 4×2 de KPIs del escritorio (semántica fija del design-system), el conteo de productos aparece:
- en **móvil** como una `KpiCard` "Productos" adicional (la grilla de 2 columnas envuelve limpio);
- en **escritorio** como el número principal del nuevo widget "Productos por categoría", ubicado junto a "Clientes por tipo".

- [ ] **Step 1: Importar queries de productos**

Añadir junto al import de clientes existente:

```typescript
import { productsKpi, productsByCategory } from "@/lib/productos/queries";
```

Y añadir `Package` a la lista de iconos importados de `lucide-react` (junto a `Users`, `Boxes`, etc.).

- [ ] **Step 2: Cargar los datos**

Reemplazar la línea:

```typescript
  const [kpi, byType] = await Promise.all([clientsKpi(supabase), clientsByType(supabase)]);
```

por:

```typescript
  const [kpi, byType, prodKpi, byCategory] = await Promise.all([
    clientsKpi(supabase), clientsByType(supabase), productsKpi(supabase), productsByCategory(supabase),
  ]);
  const totalProductos = prodKpi.total > 0 ? { value: String(prodKpi.total) } : {};
```

- [ ] **Step 3: KPI Productos en el bloque móvil**

En el `div` de móvil (`grid grid-cols-2 gap-3 lg:hidden`), añadir tras la `KpiCard` de "Bajo stock":

```tsx
        <KpiCard icon={Package} label="Productos" value={totalProductos.value} />
```

- [ ] **Step 4: Widget "Productos por categoría" junto a "Clientes por tipo"**

Reemplazar el bloque existente `{/* Escritorio: Clientes por tipo */}` completo (el `<div className="hidden lg:block">…</div>`) por una fila de dos columnas:

```tsx
      {/* Escritorio: Clientes por tipo + Productos por categoría */}
      <div className="hidden gap-4 lg:grid lg:grid-cols-2">
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
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-bold text-[var(--text)]">Productos por categoría</p>
            {prodKpi.total > 0 && <span className="text-sm font-semibold text-[var(--text-soft)]">{prodKpi.total} en total</span>}
          </div>
          {byCategory.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--text-soft)]">Aún sin productos registrados.</p>
          ) : (
            <ul className="space-y-2">
              {byCategory.map((c) => (
                <li key={c.categoryId ?? "none"} className="flex items-center justify-between text-sm">
                  <span className="text-[var(--text)]">{c.name}</span>
                  <span className="font-semibold text-[var(--text)]">{c.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
```

- [ ] **Step 5: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/dashboard/page.tsx"
git commit -m "feat(productos): KPI Productos (móvil) + widget Productos por categoría (escritorio)"
```

---

## Task 17: Verificación final

**Files:** ninguno (solo verificación).

- [ ] **Step 1: Suite completa de tests**

Run: `npx vitest run`
Expected: PASS todos (los 38 previos + los nuevos de productos/format). Si algún test de integración falla, verificar Supabase local corriendo y `npx supabase db reset` aplicado.

- [ ] **Step 2: Build de producción**

Run: `npm run build`
Expected: build exitoso, sin errores de tipos ni de compilación.

- [ ] **Step 3: E2E manual (checklist)**

Levantar `npm run dev` y verificar como **owner**:
- `/operaciones/productos` muestra empty state; "Nuevo producto" visible.
- Crear un producto con "crear categoría al vuelo" y tasa predeterminada preseleccionada → redirige al detalle; el margen aparece si hay costo.
- Lista: buscar por nombre/SKU, filtrar por categoría/tipo/estado, paginar.
- Editar y archivar/reactivar.
- `/configuracion/categorias-de-producto` y `/configuracion/tasas-de-impuesto`: crear/renombrar/desactivar; marcar otra tasa como predeterminada mueve el "Predet.".
- Dashboard: KPI "Productos" (móvil) y widget "Productos por categoría" con conteos reales.

Verificar role-gating creando un usuario **vendedor** y otro **almacen** (desde `/configuracion/usuarios`):
- **vendedor/cajero:** ven `/operaciones/productos` en lectura, SIN botón "Nuevo producto" ni "Editar/Archivar".
- **almacen:** puede crear/editar productos; NO ve "Categorías de producto" ni "Tasas de impuesto" en Configuración (y si entra por URL, redirige a `/dashboard`).

- [ ] **Step 4: Commit final (si hubo ajustes del E2E)**

```bash
git add -A
git commit -m "chore(productos): ajustes finales tras verificación E2E"
```

---

## Notas de cierre

- **DRY:** el módulo reusa `EmptyState`, `KpiCard`, los tokens visuales y el patrón `ctx()`/`FormState` de Clientes. No dupliques utilidades que ya existan en `src/lib`.
- **YAGNI:** nada de stock, variantes, imágenes, código de barras ni listas de precios en este plan (ver "Fuera de alcance" del spec).
- **AGENTS.md:** esta versión de Next.js tiene cambios; ante cualquier API de framework, consulta `node_modules/next/dist/docs/` antes de escribir código.
- **Finish:** al terminar y con la suite verde + build limpio, usar la skill `superpowers:finishing-a-development-branch` para decidir merge a `master`.
