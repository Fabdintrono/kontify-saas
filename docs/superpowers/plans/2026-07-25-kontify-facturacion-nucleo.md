# Kontify — Facturación / Núcleo de Ventas (Plan 5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Registrar documentos de venta internos (borrador→emitida→anulada) con líneas, descuentos %, impuesto por línea, correlativo por empresa, pago contado/crédito con saldo; alimentar dashboard y el detalle de Cliente. Sin abonos parciales, sin PDF, sin stock.

**Architecture:** Función pura de totales (`computeSaleTotals`) como única fuente de montos + capa de datos testeable `src/lib/ventas/*` (totals/schema/permissions/queries/mutations) + una Server Action con intent (save/emit) para el builder + acciones simples para borrar/anular. RLS con scoping por sucursal (nuevo helper `current_user_branch_id`) y correlativo gapless vía RPC `next_sale_number`. Espeja el patrón de Clientes/Productos.

**Tech Stack:** Next.js (versión custom — ver `AGENTS.md`), React Server Components + Server Actions + `useActionState`, Supabase (Postgres + RLS + RPC), Zod, Vitest, Tailwind 4.

**Prerequisito de entorno:** Supabase local corriendo (`npx supabase start`). Migraciones y tests de integración se aplican con `npx supabase db reset`.

**Referencia viva:** los módulos `src/lib/clientes/*`, `src/lib/productos/*` y sus Server Actions/UI son la plantilla exacta. NO refactorizarlos. Reusar `formatMoney` (`src/lib/format.ts`), `getTenantCurrency` (`src/lib/productos/queries.ts`), `EmptyState`, `KpiCard`.

---

## Estructura de archivos

**Migraciones (crear):**
- `supabase/migrations/0012_sales_schema.sql` — enum + `sales` + `sale_items` + `sale_counters` + índices.
- `supabase/migrations/0013_sales_rls.sql` — helper `current_user_branch_id` + policies + grants.
- `supabase/migrations/0014_sale_number_rpc.sql` — función `next_sale_number` + grant.

**Capa de datos (crear):**
- `src/lib/ventas/totals.ts` — `computeSaleTotals` + `round2` (puro).
- `src/lib/ventas/schema.ts` — Zod.
- `src/lib/ventas/permissions.ts` — `canSell`, `canVoidSale`.
- `src/lib/ventas/mutations.ts` — create/update/delete draft, emit, void.
- `src/lib/ventas/queries.ts` — listSales/getSale/salesKpi/receivablesTotal/salesByClient + lite queries (clientes/productos/sucursales).

**Server Actions (crear):**
- `src/app/(app)/operaciones/facturacion/actions.ts`.

**UI (crear):**
- `src/components/ventas/status-badge.tsx`
- `src/components/ventas/sales-table.tsx`
- `src/components/ventas/sale-row-card.tsx`
- `src/components/ventas/sales-toolbar.tsx`
- `src/components/ventas/client-picker.tsx`
- `src/components/ventas/product-picker.tsx`
- `src/components/ventas/sale-builder.tsx` (líneas inline + panel de emisión inline)
- `src/components/ventas/sale-document.tsx`
- `src/app/(app)/operaciones/facturacion/page.tsx` (lista)
- `src/app/(app)/operaciones/facturacion/nueva/page.tsx`
- `src/app/(app)/operaciones/facturacion/[id]/page.tsx` (detalle)
- `src/app/(app)/operaciones/facturacion/[id]/editar/page.tsx`

**Modificar:**
- `src/app/(app)/clientes/[id]/page.tsx` — reemplazar los 2 empty states por Historial de compras + Por cobrar reales.
- `src/app/(app)/dashboard/page.tsx` — KPIs Ventas del mes / Ticket promedio / Por cobrar reales.
- `src/components/shell/fab-vender.tsx` y `src/components/shell/mobile-bottom-nav.tsx` — el "+" navega a `/operaciones/facturacion/nueva`.

**Tests (crear):**
- `src/lib/ventas/totals.test.ts`, `src/lib/ventas/permissions.test.ts`, `src/lib/ventas/schema.test.ts`
- `tests/ventas.test.ts` (integración, requiere Supabase local).

---

## Task 1: Migración — schema

**Files:**
- Create: `supabase/migrations/0012_sales_schema.sql`

- [ ] **Step 1: Escribir la migración**

```sql
-- 0012_sales_schema.sql
create type public.sale_status as enum ('draft','issued','void');

create table public.sale_counters (
  tenant_id   uuid primary key references public.tenants(id) on delete cascade,
  last_number bigint not null default 0
);

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  number bigint,
  branch_id uuid not null references public.branches(id) on delete restrict,
  client_id uuid references public.clients(id) on delete set null,
  status public.sale_status not null default 'draft',
  currency text not null,
  global_discount_pct numeric(5,2) not null default 0,
  subtotal numeric(14,2) not null default 0,
  discount_total numeric(14,2) not null default 0,
  tax_total numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  paid_amount numeric(14,2) not null default 0,
  payment_method text,
  issued_at timestamptz,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index sales_tenant_status on public.sales (tenant_id, status);
create index sales_tenant_client on public.sales (tenant_id, client_id);
create index sales_tenant_branch on public.sales (tenant_id, branch_id);
create unique index sales_tenant_number on public.sales (tenant_id, number) where number is not null;

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  sale_id uuid not null references public.sales(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  description text not null,
  quantity numeric(14,2) not null,
  unit_price numeric(14,2) not null,
  discount_pct numeric(5,2) not null default 0,
  tax_rate numeric(5,2) not null default 0,
  position int not null default 0
);
create index sale_items_sale on public.sale_items (sale_id);
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/0012_sales_schema.sql
git commit -m "feat(ventas): migración de schema (sales, sale_items, sale_counters, índices)"
```

---

## Task 2: Migración — RLS + grants

**Files:**
- Create: `supabase/migrations/0013_sales_rls.sql`

- [ ] **Step 1: Escribir la migración**

```sql
-- 0013_sales_rls.sql
-- Helper: sucursal del usuario actual (NULL para owner/admin/administrativo).
create or replace function public.current_user_branch_id()
returns uuid language sql stable security definer set search_path = public as $$
  select branch_id from public.memberships where user_id = auth.uid() limit 1;
$$;
revoke all on function public.current_user_branch_id() from public;
grant execute on function public.current_user_branch_id() to authenticated;

alter table public.sales      enable row level security;
alter table public.sale_items enable row level security;

-- sales: back-office ve todas; vendedor/cajero solo su sucursal. Escritura: roles de venta (almacén no).
create policy sales_select on public.sales
  for select using (tenant_id = public.current_tenant_id()
    and ( public.current_user_role() in ('owner','admin','administrativo')
          or branch_id = public.current_user_branch_id() ));
create policy sales_insert on public.sales
  for insert with check (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin','administrativo','vendedor','cajero'));
create policy sales_update on public.sales
  for update using (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin','administrativo','vendedor','cajero'))
  with check (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin','administrativo','vendedor','cajero'));
create policy sales_delete on public.sales
  for delete using (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin','administrativo','vendedor','cajero'));

-- sale_items: SELECT espeja la visibilidad por sucursal de la venta padre; escritura por rol de venta.
create policy sale_items_select on public.sale_items
  for select using (tenant_id = public.current_tenant_id()
    and exists ( select 1 from public.sales s where s.id = sale_id
      and ( public.current_user_role() in ('owner','admin','administrativo')
            or s.branch_id = public.current_user_branch_id() ) ));
create policy sale_items_insert on public.sale_items
  for insert with check (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin','administrativo','vendedor','cajero'));
create policy sale_items_update on public.sale_items
  for update using (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin','administrativo','vendedor','cajero'))
  with check (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin','administrativo','vendedor','cajero'));
create policy sale_items_delete on public.sale_items
  for delete using (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin','administrativo','vendedor','cajero'));

-- sale_counters: la RPC es SECURITY DEFINER, pero el on-conflict necesita permisos base.
alter table public.sale_counters enable row level security;
create policy sale_counters_all on public.sale_counters
  for all using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

grant select, insert, update, delete on public.sales      to authenticated;
grant select, insert, update, delete on public.sale_items to authenticated;
grant select, insert, update on public.sale_counters to authenticated;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/0013_sales_rls.sql
git commit -m "feat(ventas): RLS con scoping por sucursal + helper current_user_branch_id + grants"
```

---

## Task 3: Migración — RPC correlativo

**Files:**
- Create: `supabase/migrations/0014_sale_number_rpc.sql`

- [ ] **Step 1: Escribir la migración**

```sql
-- 0014_sale_number_rpc.sql
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

revoke all on function public.next_sale_number() from public;
grant execute on function public.next_sale_number() to authenticated;
```

- [ ] **Step 2: Aplicar todas las migraciones al Supabase local**

Run: `npx supabase db reset`
Expected: termina sin error; en el log aparecen `0012`, `0013`, `0014`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0014_sale_number_rpc.sql
git commit -m "feat(ventas): RPC next_sale_number (correlativo gapless por empresa)"
```

---

## Task 4: totals.ts (TDD — la pieza central)

**Files:**
- Create: `src/lib/ventas/totals.ts`
- Test: `src/lib/ventas/totals.test.ts`

- [ ] **Step 1: Escribir el test que falla**

```typescript
import { describe, it, expect } from "vitest";
import { computeSaleTotals, round2 } from "./totals";

describe("ventas — computeSaleTotals", () => {
  it("venta vacía → todo 0", () => {
    const t = computeSaleTotals([], 0);
    expect(t).toMatchObject({ subtotal: 0, discountTotal: 0, taxTotal: 0, total: 0 });
    expect(t.lines).toEqual([]);
  });
  it("sin descuentos ni impuesto", () => {
    const t = computeSaleTotals([{ quantity: 2, unitPrice: 10, discountPct: 0, taxRate: 0 }], 0);
    expect(t).toMatchObject({ subtotal: 20, discountTotal: 0, taxTotal: 0, total: 20 });
  });
  it("impuesto 16% por línea", () => {
    const t = computeSaleTotals([{ quantity: 2, unitPrice: 10, discountPct: 0, taxRate: 16 }], 0);
    expect(t.taxTotal).toBe(3.2);
    expect(t.total).toBe(23.2);
  });
  it("descuento de línea 10%", () => {
    const t = computeSaleTotals([{ quantity: 1, unitPrice: 100, discountPct: 10, taxRate: 0 }], 0);
    expect(t).toMatchObject({ subtotal: 90, discountTotal: 10, total: 90 });
  });
  it("descuento global 10%", () => {
    const t = computeSaleTotals([{ quantity: 1, unitPrice: 100, discountPct: 0, taxRate: 0 }], 10);
    expect(t).toMatchObject({ subtotal: 100, discountTotal: 10, total: 90 });
  });
  it("línea + global + impuesto (prorrateo antes del impuesto)", () => {
    const t = computeSaleTotals([{ quantity: 1, unitPrice: 100, discountPct: 10, taxRate: 16 }], 10);
    // base100, descLínea10, neto90; descGlobal9; netoFinal81; tax=12.96; total=90-9+12.96=93.96
    expect(t).toMatchObject({ subtotal: 90, discountTotal: 19, taxTotal: 12.96, total: 93.96 });
  });
  it("dos líneas con impuestos distintos: Σ tax cuadra", () => {
    const t = computeSaleTotals([
      { quantity: 1, unitPrice: 100, discountPct: 0, taxRate: 16 },
      { quantity: 1, unitPrice: 50, discountPct: 0, taxRate: 0 },
    ], 0);
    expect(t).toMatchObject({ subtotal: 150, taxTotal: 16, total: 166 });
    expect(round2(t.lines[0].tax + t.lines[1].tax)).toBe(t.taxTotal);
  });
});
```

- [ ] **Step 2: Correr el test — debe fallar**

Run: `npx vitest run src/lib/ventas/totals.test.ts`
Expected: FAIL (no existe `./totals`).

- [ ] **Step 3: Implementar**

```typescript
export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export type SaleLineInput = { quantity: number; unitPrice: number; discountPct: number; taxRate: number };
export type SaleTotals = {
  subtotal: number; discountTotal: number; taxTotal: number; total: number;
  lines: { neto: number; tax: number; total: number }[];
};

export function computeSaleTotals(items: SaleLineInput[], globalDiscountPct = 0): SaleTotals {
  const g = globalDiscountPct || 0;
  const factorGlobal = 1 - g / 100;
  let subtotalBruto = 0, lineDiscTotal = 0, taxTotal = 0;

  const netos = items.map((it) => {
    const base = (it.quantity || 0) * (it.unitPrice || 0);
    const descLinea = base * ((it.discountPct || 0) / 100);
    const neto = base - descLinea;
    subtotalBruto += neto;
    lineDiscTotal += descLinea;
    return { neto, taxRate: it.taxRate || 0 };
  });

  const descGlobal = subtotalBruto * (g / 100);
  const lines = netos.map((n) => {
    const netoFinal = n.neto * factorGlobal;
    const tax = netoFinal * (n.taxRate / 100);
    taxTotal += tax;
    return { neto: round2(n.neto), tax: round2(tax), total: round2(netoFinal + tax) };
  });

  return {
    subtotal: round2(subtotalBruto),
    discountTotal: round2(lineDiscTotal + descGlobal),
    taxTotal: round2(taxTotal),
    total: round2(subtotalBruto - descGlobal + taxTotal),
    lines,
  };
}
```

- [ ] **Step 4: Correr el test — debe pasar**

Run: `npx vitest run src/lib/ventas/totals.test.ts`
Expected: PASS (7/7).

- [ ] **Step 5: Commit**

```bash
git add src/lib/ventas/totals.ts src/lib/ventas/totals.test.ts
git commit -m "feat(ventas): computeSaleTotals con test exhaustivo (descuentos + impuesto)"
```

---

## Task 5: permissions.ts (TDD)

**Files:**
- Create: `src/lib/ventas/permissions.ts`
- Test: `src/lib/ventas/permissions.test.ts`

- [ ] **Step 1: Escribir el test que falla**

```typescript
import { describe, it, expect } from "vitest";
import { canSell, canVoidSale } from "./permissions";

describe("ventas — permissions", () => {
  it("canSell: owner/admin/administrativo/vendedor/cajero sí; almacen no", () => {
    expect(["owner", "admin", "administrativo", "vendedor", "cajero"].every(canSell as any)).toBe(true);
    expect(canSell("almacen")).toBe(false);
  });
  it("canVoidSale solo owner/admin", () => {
    expect(canVoidSale("owner")).toBe(true);
    expect(canVoidSale("admin")).toBe(true);
    expect(canVoidSale("administrativo")).toBe(false);
    expect(canVoidSale("vendedor")).toBe(false);
    expect(canVoidSale("almacen")).toBe(false);
  });
});
```

- [ ] **Step 2: Correr el test — debe fallar**

Run: `npx vitest run src/lib/ventas/permissions.test.ts`
Expected: FAIL (no existe `./permissions`).

- [ ] **Step 3: Implementar**

```typescript
import type { Role } from "@/lib/auth/roles";

const SELL_ROLES: Role[] = ["owner", "admin", "administrativo", "vendedor", "cajero"];

export const canSell = (role: Role): boolean => SELL_ROLES.includes(role);
export const canVoidSale = (role: Role): boolean => role === "owner" || role === "admin";
```

- [ ] **Step 4: Correr el test — debe pasar**

Run: `npx vitest run src/lib/ventas/permissions.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ventas/permissions.ts src/lib/ventas/permissions.test.ts
git commit -m "feat(ventas): helpers de permisos con test"
```

---

## Task 6: schema.ts (TDD)

**Files:**
- Create: `src/lib/ventas/schema.ts`
- Test: `src/lib/ventas/schema.test.ts`

- [ ] **Step 1: Escribir el test que falla**

```typescript
import { describe, it, expect } from "vitest";
import { saleLineSchema, saleSaveSchema, saleEmitSchema, emitSchema } from "./schema";

const line = { productId: null, description: "Café", quantity: 1, unitPrice: 10, discountPct: 0, taxRate: 16 };
const base = { clientId: null, branchId: "00000000-0000-0000-0000-000000000001", globalDiscountPct: 0, notes: "", items: [line] };

describe("ventas — schema", () => {
  it("línea válida y castea números", () => {
    const r = saleLineSchema.safeParse({ ...line, quantity: "2", unitPrice: "9.5" });
    expect(r.success).toBe(true);
    if (r.success) { expect(r.data.quantity).toBe(2); expect(r.data.unitPrice).toBe(9.5); }
  });
  it("línea rechaza quantity 0 o negativa", () => {
    expect(saleLineSchema.safeParse({ ...line, quantity: 0 }).success).toBe(false);
    expect(saleLineSchema.safeParse({ ...line, quantity: -1 }).success).toBe(false);
  });
  it("saleSaveSchema permite 0 líneas; saleEmitSchema exige ≥1", () => {
    expect(saleSaveSchema.safeParse({ ...base, items: [] }).success).toBe(true);
    expect(saleEmitSchema.safeParse({ ...base, items: [] }).success).toBe(false);
    expect(saleEmitSchema.safeParse(base).success).toBe(true);
  });
  it("emitSchema valida paymentType", () => {
    expect(emitSchema.safeParse({ paymentType: "contado", paymentMethod: "efectivo" }).success).toBe(true);
    expect(emitSchema.safeParse({ paymentType: "credito" }).success).toBe(true);
    expect(emitSchema.safeParse({ paymentType: "otro" }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Correr el test — debe fallar**

Run: `npx vitest run src/lib/ventas/schema.test.ts`
Expected: FAIL (no existe `./schema`).

- [ ] **Step 3: Implementar**

```typescript
import { z } from "zod";

const optStr = (max: number) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().max(max).optional());

const optId =
  z.preprocess((v) => (v === "" || v === "null" || v === undefined ? null : v),
    z.string().uuid().nullable().optional());

export const saleLineSchema = z.object({
  productId: optId,
  description: z.string().trim().min(1, "Descripción requerida").max(160),
  quantity: z.coerce.number().positive("Cantidad debe ser > 0"),
  unitPrice: z.coerce.number().min(0, "Precio ≥ 0"),
  discountPct: z.coerce.number().min(0).max(100).default(0),
  taxRate: z.coerce.number().min(0).max(100).default(0),
});
export type SaleLineInputZ = z.infer<typeof saleLineSchema>;

export const saleSaveSchema = z.object({
  clientId: optId,
  branchId: z.string().uuid("Sucursal requerida"),
  globalDiscountPct: z.coerce.number().min(0).max(100).default(0),
  notes: optStr(1000),
  items: z.array(saleLineSchema),
});
export type SaleSaveInput = z.infer<typeof saleSaveSchema>;

export const saleEmitSchema = saleSaveSchema.extend({
  items: z.array(saleLineSchema).min(1, "Agrega al menos una línea"),
});

export const emitSchema = z.object({
  paymentType: z.enum(["contado", "credito"], { message: "Tipo de pago inválido" }),
  paymentMethod: optStr(40),
});
export type EmitInput = z.infer<typeof emitSchema>;
```

- [ ] **Step 4: Correr el test — debe pasar**

Run: `npx vitest run src/lib/ventas/schema.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ventas/schema.ts src/lib/ventas/schema.test.ts
git commit -m "feat(ventas): esquemas Zod con test (línea/guardar/emitir/pago)"
```

---

## Task 7: mutations.ts

**Files:**
- Create: `src/lib/ventas/mutations.ts`

(Se ejercita en los tests de integración de la Task 9.)

- [ ] **Step 1: Implementar**

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SaleSaveInput, EmitInput } from "@/lib/ventas/schema";
import { computeSaleTotals } from "@/lib/ventas/totals";

function headerTotals(input: SaleSaveInput) {
  const t = computeSaleTotals(
    input.items.map((i) => ({ quantity: i.quantity, unitPrice: i.unitPrice, discountPct: i.discountPct, taxRate: i.taxRate })),
    input.globalDiscountPct,
  );
  return { subtotal: t.subtotal, discount_total: t.discountTotal, tax_total: t.taxTotal, total: t.total };
}

async function replaceItems(sb: SupabaseClient, saleId: string, tenantId: string, input: SaleSaveInput) {
  const { error: delErr } = await sb.from("sale_items").delete().eq("sale_id", saleId);
  if (delErr) throw delErr;
  if (input.items.length === 0) return;
  const rows = input.items.map((i, idx) => ({
    tenant_id: tenantId, sale_id: saleId, product_id: i.productId ?? null,
    description: i.description, quantity: i.quantity, unit_price: i.unitPrice,
    discount_pct: i.discountPct, tax_rate: i.taxRate, position: idx,
  }));
  const { error } = await sb.from("sale_items").insert(rows);
  if (error) throw error;
}

export async function createDraft(
  sb: SupabaseClient, tenantId: string, userId: string, currency: string, input: SaleSaveInput,
): Promise<string> {
  const { data, error } = await sb.from("sales").insert({
    tenant_id: tenantId, created_by: userId, branch_id: input.branchId, client_id: input.clientId ?? null,
    status: "draft", currency, global_discount_pct: input.globalDiscountPct, notes: input.notes ?? null,
    ...headerTotals(input),
  }).select("id").single();
  if (error) throw error;
  await replaceItems(sb, data.id, tenantId, input);
  return data.id as string;
}

export async function updateDraft(sb: SupabaseClient, id: string, tenantId: string, input: SaleSaveInput): Promise<void> {
  const { data, error } = await sb.from("sales").update({
    branch_id: input.branchId, client_id: input.clientId ?? null,
    global_discount_pct: input.globalDiscountPct, notes: input.notes ?? null,
    ...headerTotals(input), updated_at: new Date().toISOString(),
  }).eq("id", id).eq("status", "draft").select("id");
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("La venta no es un borrador editable");
  await replaceItems(sb, id, tenantId, input);
}

export async function deleteDraft(sb: SupabaseClient, id: string): Promise<void> {
  const { data, error } = await sb.from("sales").delete().eq("id", id).eq("status", "draft").select("id");
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("Solo se pueden borrar borradores");
}

export async function emitSale(sb: SupabaseClient, id: string, payment: EmitInput): Promise<void> {
  const { data: sale, error: readErr } = await sb.from("sales").select("id, status, total").eq("id", id).maybeSingle();
  if (readErr) throw readErr;
  if (!sale || sale.status !== "draft") throw new Error("Solo se emiten borradores");
  const { count } = await sb.from("sale_items").select("id", { count: "exact", head: true }).eq("sale_id", id);
  if (!count) throw new Error("La venta no tiene líneas");
  const { data: num, error: numErr } = await sb.rpc("next_sale_number");
  if (numErr) throw numErr;
  const paid = payment.paymentType === "contado" ? Number(sale.total) : 0;
  const { error } = await sb.from("sales").update({
    number: num, status: "issued", issued_at: new Date().toISOString(),
    paid_amount: paid, payment_method: payment.paymentType === "contado" ? (payment.paymentMethod ?? null) : null,
    updated_at: new Date().toISOString(),
  }).eq("id", id).eq("status", "draft");
  if (error) throw error;
}

export async function voidSale(sb: SupabaseClient, id: string): Promise<void> {
  const { data, error } = await sb.from("sales").update({ status: "void", updated_at: new Date().toISOString() })
    .eq("id", id).eq("status", "issued").select("id");
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("Solo se anulan ventas emitidas");
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/ventas/mutations.ts
git commit -m "feat(ventas): mutaciones (draft create/update/delete, emit con correlativo, void)"
```

---

## Task 8: queries.ts

**Files:**
- Create: `src/lib/ventas/queries.ts`

- [ ] **Step 1: Implementar**

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";
import { computeSaleTotals, round2 } from "@/lib/ventas/totals";

export type SaleStatusFilter = "borradores" | "emitidas" | "anuladas" | "todas";
export type SalePaymentFilter = "pendientes" | "todas";
export type SaleListRow = {
  id: string; number: number | null; status: "draft" | "issued" | "void";
  clientName: string | null; branchName: string | null;
  total: number; balance: number; currency: string; issuedAt: string | null; createdAt: string;
};

const STATUS_MAP: Record<string, string> = { borradores: "draft", emitidas: "issued", anuladas: "void" };
const NIL_UUID = "00000000-0000-0000-0000-000000000000";
function sanitize(term: string): string { return term.replace(/[%,()*]/g, " ").trim(); }
function monthStartISO(): string { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d.toISOString(); }

export async function listSales(sb: SupabaseClient, opts: {
  search?: string; status?: SaleStatusFilter; payment?: SalePaymentFilter; page?: number; pageSize?: number;
} = {}): Promise<{ rows: SaleListRow[]; total: number; page: number; pageSize: number }> {
  const { search = "", status = "todas", payment = "todas", page = 1, pageSize = 20 } = opts;
  let q = sb.from("sales").select(
    "id, number, status, total, paid_amount, currency, issued_at, created_at, clients(name), branches(name)",
    { count: "exact" },
  );
  if (STATUS_MAP[status]) q = q.eq("status", STATUS_MAP[status]);
  // núcleo: sin abonos parciales → pendiente = emitida con paid_amount 0. (Cobros cambiará esto a balance>0.)
  if (payment === "pendientes") q = q.eq("status", "issued").eq("paid_amount", 0);
  const s = sanitize(search);
  if (s) {
    if (/^\d+$/.test(s)) {
      q = q.eq("number", Number(s));
    } else {
      const { data: cids } = await sb.from("clients").select("id").ilike("name", `%${s}%`);
      const ids = (cids ?? []).map((c: any) => c.id);
      q = q.in("client_id", ids.length ? ids : [NIL_UUID]);
    }
  }
  const from = (page - 1) * pageSize;
  q = q.order("created_at", { ascending: false }).range(from, from + pageSize - 1);
  const { data, error, count } = await q;
  if (error) throw error;
  const rows: SaleListRow[] = (data ?? []).map((r: any) => ({
    id: r.id, number: r.number, status: r.status,
    clientName: r.clients?.name ?? null, branchName: r.branches?.name ?? null,
    total: Number(r.total), balance: round2(Number(r.total) - Number(r.paid_amount)),
    currency: r.currency, issuedAt: r.issued_at, createdAt: r.created_at,
  }));
  return { rows, total: count ?? 0, page, pageSize };
}

export async function getSale(sb: SupabaseClient, id: string) {
  const { data, error } = await sb.from("sales").select("*, clients(name), branches(name)").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { data: items } = await sb.from("sale_items").select("*").eq("sale_id", id).order("position");
  const computed = computeSaleTotals(
    (items ?? []).map((i: any) => ({
      quantity: Number(i.quantity), unitPrice: Number(i.unit_price),
      discountPct: Number(i.discount_pct), taxRate: Number(i.tax_rate),
    })),
    Number(data.global_discount_pct),
  );
  return { ...(data as any), items: items ?? [], computed };
}

export async function salesKpi(sb: SupabaseClient): Promise<{ monthTotal: number; avgTicket: number }> {
  try {
    const { data, error } = await sb.from("sales").select("total").eq("status", "issued").gte("issued_at", monthStartISO());
    if (error || !data) return { monthTotal: 0, avgTicket: 0 };
    const monthTotal = data.reduce((s: number, r: any) => s + Number(r.total), 0);
    return { monthTotal: round2(monthTotal), avgTicket: data.length ? round2(monthTotal / data.length) : 0 };
  } catch { return { monthTotal: 0, avgTicket: 0 }; }
}

export async function receivablesTotal(sb: SupabaseClient): Promise<{ total: number }> {
  try {
    const { data, error } = await sb.from("sales").select("total, paid_amount").eq("status", "issued");
    if (error || !data) return { total: 0 };
    return { total: round2(data.reduce((s: number, r: any) => s + (Number(r.total) - Number(r.paid_amount)), 0)) };
  } catch { return { total: 0 }; }
}

export async function salesByClient(sb: SupabaseClient, clientId: string): Promise<{
  list: { id: string; number: number | null; total: number; balance: number; issuedAt: string | null }[];
  purchasedTotal: number; receivable: number;
}> {
  try {
    const { data, error } = await sb.from("sales").select("id, number, total, paid_amount, issued_at")
      .eq("client_id", clientId).eq("status", "issued").order("issued_at", { ascending: false });
    if (error || !data) return { list: [], purchasedTotal: 0, receivable: 0 };
    const purchasedTotal = data.reduce((s: number, r: any) => s + Number(r.total), 0);
    const receivable = data.reduce((s: number, r: any) => s + (Number(r.total) - Number(r.paid_amount)), 0);
    return {
      list: data.map((r: any) => ({ id: r.id, number: r.number, total: Number(r.total), balance: round2(Number(r.total) - Number(r.paid_amount)), issuedAt: r.issued_at })),
      purchasedTotal: round2(purchasedTotal), receivable: round2(receivable),
    };
  } catch { return { list: [], purchasedTotal: 0, receivable: 0 }; }
}

// Listas ligeras para el builder (client-side search; caps razonables para el núcleo).
export async function listActiveClientsLite(sb: SupabaseClient) {
  const { data } = await sb.from("clients").select("id, name").eq("active", true).order("name").limit(500);
  return (data ?? []) as { id: string; name: string }[];
}
export async function listActiveProductsLite(sb: SupabaseClient) {
  const { data } = await sb.from("products").select("id, name, price, unit, tax_rates(rate)").eq("active", true).order("name").limit(1000);
  return (data ?? []).map((p: any) => ({ id: p.id, name: p.name, price: Number(p.price), unit: p.unit, taxRate: p.tax_rates ? Number(p.tax_rates.rate) : 0 }));
}
export async function listBranches(sb: SupabaseClient) {
  const { data } = await sb.from("branches").select("id, name, is_main").order("is_main", { ascending: false });
  return (data ?? []) as { id: string; name: string; is_main: boolean }[];
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/ventas/queries.ts
git commit -m "feat(ventas): queries (lista/detalle/kpi/por-cobrar/historial + listas lite)"
```

---

## Task 9: Tests de integración (RLS + flujo)

**Files:**
- Create: `tests/ventas.test.ts`

**Prerequisito:** Supabase local corriendo con migraciones aplicadas (`npx supabase db reset`).

- [ ] **Step 1: Escribir los tests**

```typescript
import { describe, it, expect } from "vitest";
import { newUserClient } from "./setup";
import type { SaleSaveInput } from "@/lib/ventas/schema";
import { createDraft, emitSale, voidSale, deleteDraft } from "@/lib/ventas/mutations";
import { listSales, salesKpi, receivablesTotal, salesByClient } from "@/lib/ventas/queries";

async function makeTenant(name: string) {
  const u = await newUserClient();
  const { data: tenantId } = await u.client.rpc("bootstrap_tenant", {
    p_name: name, p_slug: `${name}-${Date.now()}-${Math.random()}`, p_full_name: name,
  });
  return { ...u, tenantId: tenantId as string };
}
async function addMember(owner: Awaited<ReturnType<typeof makeTenant>>, role: string, branchId: string | null = null) {
  const u = await newUserClient();
  const { error } = await owner.client.from("memberships").insert({ user_id: u.id, tenant_id: owner.tenantId, role, branch_id: branchId });
  if (error) throw error;
  return u;
}
async function mainBranch(t: Awaited<ReturnType<typeof makeTenant>>) {
  const { data } = await t.client.from("branches").select("id").eq("tenant_id", t.tenantId).eq("is_main", true).single();
  return data!.id as string;
}
const sale = (branchId: string, over: Partial<SaleSaveInput> = {}): SaleSaveInput => ({
  clientId: null, branchId, globalDiscountPct: 0, notes: undefined,
  items: [{ productId: null, description: "Prod", quantity: 2, unitPrice: 10, discountPct: 0, taxRate: 16 }], ...over,
});

describe("ventas — flujo y correlativo", () => {
  it("crear borrador → emitir asigna correlativo consecutivo; contado deja saldo 0", async () => {
    const a = await makeTenant("flow");
    const b = await mainBranch(a);
    const id1 = await createDraft(a.client, a.tenantId, a.id, "USD", sale(b));
    const id2 = await createDraft(a.client, a.tenantId, a.id, "USD", sale(b));
    await emitSale(a.client, id1, { paymentType: "contado", paymentMethod: "efectivo" });
    await emitSale(a.client, id2, { paymentType: "credito" });

    const emitidas = await listSales(a.client, { status: "emitidas" });
    const nums = emitidas.rows.map((r) => r.number).sort((x, y) => (x! - y!));
    expect(nums).toEqual([1, 2]);

    const s1 = emitidas.rows.find((r) => r.number === 1)!;
    expect(s1.total).toBe(23.2);       // 2*10 + 16%
    expect(s1.balance).toBe(0);        // contado
    const s2 = emitidas.rows.find((r) => r.number === 2)!;
    expect(s2.balance).toBe(23.2);     // crédito
  });

  it("KPIs y por-cobrar; anular saca la venta de los totales", async () => {
    const a = await makeTenant("kpi");
    const b = await mainBranch(a);
    const id = await createDraft(a.client, a.tenantId, a.id, "USD", sale(b, { items: [{ productId: null, description: "X", quantity: 1, unitPrice: 100, discountPct: 0, taxRate: 0 }] }));
    await emitSale(a.client, id, { paymentType: "credito" });
    expect((await salesKpi(a.client)).monthTotal).toBe(100);
    expect((await receivablesTotal(a.client)).total).toBe(100);
    await voidSale(a.client, id);
    expect((await salesKpi(a.client)).monthTotal).toBe(0);
    expect((await receivablesTotal(a.client)).total).toBe(0);
  });

  it("borrar un borrador elimina sus ítems (cascade)", async () => {
    const a = await makeTenant("del");
    const b = await mainBranch(a);
    const id = await createDraft(a.client, a.tenantId, a.id, "USD", sale(b));
    await deleteDraft(a.client, id);
    const { count } = await a.client.from("sale_items").select("id", { count: "exact", head: true }).eq("sale_id", id);
    expect(count ?? 0).toBe(0);
  });

  it("historial por cliente", async () => {
    const a = await makeTenant("hist");
    const b = await mainBranch(a);
    const { data: cli } = await a.client.from("clients").insert({ tenant_id: a.tenantId, kind: "person", name: "Ana" }).select("id").single();
    const id = await createDraft(a.client, a.tenantId, a.id, "USD", sale(b, { clientId: cli!.id }));
    await emitSale(a.client, id, { paymentType: "credito" });
    const h = await salesByClient(a.client, cli!.id);
    expect(h.list).toHaveLength(1);
    expect(h.purchasedTotal).toBe(23.2);
    expect(h.receivable).toBe(23.2);
  });
});

describe("ventas — RLS", () => {
  it("un tenant no ve ventas de otro", async () => {
    const a = await makeTenant("aa"); const b = await makeTenant("bb");
    await createDraft(a.client, a.tenantId, a.id, "USD", sale(await mainBranch(a)));
    expect((await listSales(b.client, { status: "todas" })).total).toBe(0);
  });

  it("scoping por sucursal: vendedor de otra sucursal no ve la venta; back-office sí", async () => {
    const a = await makeTenant("scope");
    const main = await mainBranch(a);
    const { data: otra } = await a.client.from("branches").insert({ tenant_id: a.tenantId, name: "Sur" }).select("id").single();
    // venta en sucursal principal (creada por el owner)
    await createDraft(a.client, a.tenantId, a.id, "USD", sale(main));
    const vendedorOtra = await addMember(a, "vendedor", otra!.id);
    const vendedorMain = await addMember(a, "vendedor", main);
    const admin = await addMember(a, "administrativo", null);
    expect((await listSales(vendedorOtra.client, { status: "todas" })).total).toBe(0); // otra sucursal
    expect((await listSales(vendedorMain.client, { status: "todas" })).total).toBe(1); // su sucursal
    expect((await listSales(admin.client, { status: "todas" })).total).toBe(1);        // back-office ve todo
  });

  it("almacen no puede insertar ventas (RLS niega)", async () => {
    const a = await makeTenant("alm");
    const main = await mainBranch(a);
    const almacen = await addMember(a, "almacen", main);
    const { error } = await almacen.client.from("sales")
      .insert({ tenant_id: a.tenantId, branch_id: main, status: "draft", currency: "USD" });
    expect(error).not.toBeNull();
  });
});
```

- [ ] **Step 2: Correr los tests — deben pasar**

Run: `npx vitest run tests/ventas.test.ts`
Expected: PASS (todos). Si falla, verificar `npx supabase db reset` aplicado.

- [ ] **Step 3: Commit**

```bash
git add tests/ventas.test.ts
git commit -m "test(ventas): integración RLS + scoping sucursal + correlativo + kpi/por-cobrar"
```

---

## Task 10: Server Actions

**Files:**
- Create: `src/app/(app)/operaciones/facturacion/actions.ts`

- [ ] **Step 1: Implementar**

```typescript
"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient as serverSupabase } from "@/lib/supabase/server";
import { getTenantCurrency } from "@/lib/productos/queries";
import { saleSaveSchema, saleEmitSchema, emitSchema } from "@/lib/ventas/schema";
import { canSell, canVoidSale } from "@/lib/ventas/permissions";
import * as m from "@/lib/ventas/mutations";
import type { Role } from "@/lib/auth/roles";

export type FormState = { ok: boolean; error?: string; fieldErrors?: Record<string, string> };
const LIST = "/operaciones/facturacion";

function zodErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of err.issues) { const k = String(i.path.join(".") || "_"); if (!out[k]) out[k] = i.message; }
  return out;
}

async function ctx() {
  const sb = await serverSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const { data: mem } = await sb.from("memberships").select("role").eq("user_id", user.id).single();
  const { data: tenantId } = await sb.rpc("current_tenant_id");
  return { sb, userId: user.id, role: (mem?.role ?? "vendedor") as Role, tenantId: tenantId as string };
}

function commonFields(fd: FormData) {
  let items: unknown = [];
  try { items = JSON.parse(String(fd.get("items") ?? "[]")); } catch { items = null; }
  return {
    clientId: fd.get("clientId"),
    branchId: fd.get("branchId"),
    globalDiscountPct: fd.get("globalDiscountPct"),
    notes: fd.get("notes"),
    items,
  };
}

// Acción única con intent (save | emit) para el builder; compatible con useActionState.
export async function submitSaleAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { sb, userId, role, tenantId } = await ctx();
  if (!canSell(role)) return { ok: false, error: "Sin permiso" };
  const intent = String(fd.get("intent") ?? "save");
  const id = String(fd.get("id") ?? "");

  const schema = intent === "emit" ? saleEmitSchema : saleSaveSchema;
  const parsed = schema.safeParse(commonFields(fd));
  if (!parsed.success) return { ok: false, fieldErrors: zodErrors(parsed.error) };

  let saleId = id;
  try {
    const currency = await getTenantCurrency(sb);
    if (id) await m.updateDraft(sb, id, tenantId, parsed.data);
    else saleId = await m.createDraft(sb, tenantId, userId, currency, parsed.data);

    if (intent === "emit") {
      const pay = emitSchema.safeParse({ paymentType: fd.get("paymentType"), paymentMethod: fd.get("paymentMethod") });
      if (!pay.success) return { ok: false, fieldErrors: zodErrors(pay.error) };
      await m.emitSale(sb, saleId, pay.data);
    }
  } catch (e) { return { ok: false, error: (e as Error).message }; }

  revalidatePath(LIST);
  revalidatePath(`${LIST}/${saleId}`);
  revalidatePath("/dashboard");
  if (parsed.data.clientId) revalidatePath(`/clientes/${parsed.data.clientId}`);
  redirect(`${LIST}/${saleId}`);
}

export async function deleteDraftAction(fd: FormData): Promise<void> {
  const { sb, role } = await ctx();
  if (!canSell(role)) return;
  const id = String(fd.get("id") ?? "");
  await m.deleteDraft(sb, id);
  revalidatePath(LIST);
  redirect(LIST);
}

export async function voidSaleAction(fd: FormData): Promise<void> {
  const { sb, role } = await ctx();
  if (!canVoidSale(role)) return; // botón oculto; defensa extra
  const id = String(fd.get("id") ?? "");
  const clientId = String(fd.get("clientId") ?? "");
  await m.voidSale(sb, id);
  revalidatePath(LIST);
  revalidatePath(`${LIST}/${id}`);
  revalidatePath("/dashboard");
  if (clientId) revalidatePath(`/clientes/${clientId}`);
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos en `actions.ts`.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/operaciones/facturacion/actions.ts"
git commit -m "feat(ventas): Server Actions (submit con intent save/emit, borrar, anular)"
```

---

## Task 11: Componentes de lista (badge, table, card, toolbar)

**Files:**
- Create: `src/components/ventas/status-badge.tsx`, `sales-table.tsx`, `sale-row-card.tsx`, `sales-toolbar.tsx`

- [ ] **Step 1: status-badge.tsx**

```tsx
const MAP: Record<string, { label: string; cls: string }> = {
  draft:  { label: "Borrador", cls: "bg-[var(--bg)] text-[var(--text-soft)]" },
  issued: { label: "Emitida",  cls: "bg-[#0e7490]/10 text-[#0e7490] dark:text-[#5eead4]" },
  void:   { label: "Anulada",  cls: "bg-[#dc2626]/10 text-[#dc2626]" },
};

export function SaleStatusBadge({ status }: { status: string }) {
  const s = MAP[status] ?? { label: status, cls: "bg-[var(--bg)] text-[var(--text-soft)]" };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span>;
}
```

- [ ] **Step 2: sales-table.tsx**

```tsx
import Link from "next/link";
import type { SaleListRow } from "@/lib/ventas/queries";
import { formatMoney } from "@/lib/format";
import { SaleStatusBadge } from "./status-badge";

export function SalesTable({ rows }: { rows: SaleListRow[] }) {
  return (
    <table className="hidden w-full text-sm lg:table">
      <thead>
        <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--text-soft)]">
          <th className="py-2 font-medium">Nº</th><th className="font-medium">Fecha</th><th className="font-medium">Cliente</th>
          <th className="font-medium">Total</th><th className="font-medium">Saldo</th><th className="font-medium">Estado</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className="border-b border-[var(--border)] hover:bg-[var(--bg)]">
            <td className="py-2.5">
              <Link href={`/operaciones/facturacion/${r.id}`} className="font-medium text-[var(--text)] hover:text-[#0e7490]">
                {r.number != null ? `#${r.number}` : "—"}
              </Link>
            </td>
            <td className="text-[var(--text-soft)]">{new Date(r.issuedAt ?? r.createdAt).toLocaleDateString("es-VE")}</td>
            <td className="text-[var(--text)]">{r.clientName ?? "Consumidor final"}</td>
            <td className="text-[var(--text)]">{formatMoney(r.total, r.currency)}</td>
            <td className={r.balance > 0 ? "text-[#dc2626]" : "text-[var(--text-soft)]"}>{formatMoney(r.balance, r.currency)}</td>
            <td><SaleStatusBadge status={r.status} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 3: sale-row-card.tsx**

```tsx
import Link from "next/link";
import type { SaleListRow } from "@/lib/ventas/queries";
import { formatMoney } from "@/lib/format";
import { SaleStatusBadge } from "./status-badge";

export function SaleRowCard({ r }: { r: SaleListRow }) {
  return (
    <Link href={`/operaciones/facturacion/${r.id}`}
      className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 lg:hidden">
      <div className="min-w-0">
        <p className="truncate font-medium text-[var(--text)]">
          {r.number != null ? `#${r.number}` : "Borrador"} · {r.clientName ?? "Consumidor final"}
        </p>
        <p className="truncate text-xs text-[var(--text-soft)]">
          {formatMoney(r.total, r.currency)}{r.balance > 0 ? ` · saldo ${formatMoney(r.balance, r.currency)}` : ""}
        </p>
      </div>
      <SaleStatusBadge status={r.status} />
    </Link>
  );
}
```

- [ ] **Step 4: sales-toolbar.tsx**

```tsx
"use client";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

export function SalesToolbar() {
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
        <input defaultValue={sp.get("q") ?? ""} placeholder="Buscar por número o cliente…"
          onKeyDown={(e) => { if (e.key === "Enter") setParam("q", (e.target as HTMLInputElement).value); }}
          className="w-full bg-transparent text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-soft)]" />
      </div>
      <select className={sel} defaultValue={sp.get("status") ?? "todas"} onChange={(e) => setParam("status", e.target.value)}>
        <option value="todas">Todos los estados</option>
        <option value="borradores">Borradores</option>
        <option value="emitidas">Emitidas</option>
        <option value="anuladas">Anuladas</option>
      </select>
      <select className={sel} defaultValue={sp.get("payment") ?? "todas"} onChange={(e) => setParam("payment", e.target.value)}>
        <option value="todas">Pago: todas</option>
        <option value="pendientes">Pendientes</option>
      </select>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/ventas/status-badge.tsx src/components/ventas/sales-table.tsx src/components/ventas/sale-row-card.tsx src/components/ventas/sales-toolbar.tsx
git commit -m "feat(ventas): componentes de lista (badge con fallback, table, card, toolbar)"
```

---

## Task 12: Pickers (cliente + producto)

**Files:**
- Create: `src/components/ventas/client-picker.tsx`, `src/components/ventas/product-picker.tsx`

- [ ] **Step 1: client-picker.tsx**

```tsx
"use client";
import { useState } from "react";

export type LiteClient = { id: string; name: string };

export function ClientPicker({ clients, value, onChange }: {
  clients: LiteClient[]; value: string | null; onChange: (id: string | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const selected = clients.find((c) => c.id === value);
  const matches = query.trim()
    ? clients.filter((c) => c.name.toLowerCase().includes(query.toLowerCase())).slice(0, 8)
    : clients.slice(0, 8);
  const inputCls = "w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[#0e7490]";

  return (
    <div className="relative">
      <input className={inputCls} placeholder="Consumidor final"
        value={open ? query : (selected?.name ?? "")}
        onFocus={() => { setOpen(true); setQuery(""); }}
        onChange={(e) => setQuery(e.target.value)}
        onBlur={() => setTimeout(() => setOpen(false), 150)} />
      {open && (
        <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-[10px] border border-[var(--border)] bg-[var(--surface)] shadow-lg">
          <li><button type="button" onMouseDown={(e) => { e.preventDefault(); onChange(null); setOpen(false); }}
            className="block w-full px-3 py-2 text-left text-sm text-[var(--text-soft)] hover:bg-[var(--bg)]">Consumidor final</button></li>
          {matches.map((c) => (
            <li key={c.id}><button type="button" onMouseDown={(e) => { e.preventDefault(); onChange(c.id); setOpen(false); }}
              className="block w-full px-3 py-2 text-left text-sm text-[var(--text)] hover:bg-[var(--bg)]">{c.name}</button></li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: product-picker.tsx**

```tsx
"use client";
import { useState } from "react";

export type LiteProduct = { id: string; name: string; price: number; unit: string; taxRate: number };

export function ProductPicker({ products, onPick }: { products: LiteProduct[]; onPick: (p: LiteProduct) => void }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const matches = query.trim()
    ? products.filter((p) => p.name.toLowerCase().includes(query.toLowerCase())).slice(0, 8)
    : products.slice(0, 8);
  const inputCls = "w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[#0e7490]";

  return (
    <div className="relative">
      <input className={inputCls} placeholder="Agregar producto…" value={query}
        onFocus={() => setOpen(true)} onChange={(e) => setQuery(e.target.value)}
        onBlur={() => setTimeout(() => setOpen(false), 150)} />
      {open && matches.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-[10px] border border-[var(--border)] bg-[var(--surface)] shadow-lg">
          {matches.map((p) => (
            <li key={p.id}><button type="button"
              onMouseDown={(e) => { e.preventDefault(); onPick(p); setQuery(""); setOpen(false); }}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-[var(--text)] hover:bg-[var(--bg)]">
              <span>{p.name}</span><span className="text-xs text-[var(--text-soft)]">{p.price}</span>
            </button></li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ventas/client-picker.tsx src/components/ventas/product-picker.tsx
git commit -m "feat(ventas): pickers buscables de cliente y producto"
```

---

## Task 13: Builder de venta (con emisión inline)

**Files:**
- Create: `src/components/ventas/sale-builder.tsx`

- [ ] **Step 1: Implementar**

```tsx
"use client";
import { useActionState, useState } from "react";
import { Trash2 } from "lucide-react";
import { submitSaleAction, type FormState } from "@/app/(app)/operaciones/facturacion/actions";
import { computeSaleTotals } from "@/lib/ventas/totals";
import { formatMoney } from "@/lib/format";
import { ClientPicker, type LiteClient } from "./client-picker";
import { ProductPicker, type LiteProduct } from "./product-picker";

type Line = { productId: string | null; description: string; quantity: number; unitPrice: number; discountPct: number; taxRate: number };
type Branch = { id: string; name: string; is_main: boolean };
type Values = { id?: string; clientId?: string | null; branchId?: string; globalDiscountPct?: number; notes?: string; items?: Line[] };

const initial: FormState = { ok: false };
const inputCls = "w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[#0e7490]";
const labelCls = "mb-1 block text-xs font-medium text-[var(--text-soft)]";
const cell = "w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm text-[var(--text)] outline-none focus:border-[#0e7490]";

export function SaleBuilder({ clients, products, branches, role, userBranchId, currency, values = {} }: {
  clients: LiteClient[]; products: LiteProduct[]; branches: Branch[];
  role: string; userBranchId: string | null; currency: string; values?: Values;
}) {
  const [state, formAction, pending] = useActionState(submitSaleAction, initial);
  const isBackOffice = ["owner", "admin", "administrativo"].includes(role);
  const defaultBranch = values.branchId ?? userBranchId ?? branches.find((b) => b.is_main)?.id ?? branches[0]?.id ?? "";

  const [clientId, setClientId] = useState<string | null>(values.clientId ?? null);
  const [branchId, setBranchId] = useState<string>(defaultBranch);
  const [globalDiscountPct, setGlobalDiscountPct] = useState<number>(values.globalDiscountPct ?? 0);
  const [notes, setNotes] = useState<string>(values.notes ?? "");
  const [lines, setLines] = useState<Line[]>(values.items ?? []);
  const [emitOpen, setEmitOpen] = useState(false);
  const [paymentType, setPaymentType] = useState<"contado" | "credito">("contado");

  const totals = computeSaleTotals(lines, globalDiscountPct);
  const setLine = (i: number, patch: Partial<Line>) => setLines((prev) => prev.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  const addProduct = (p: LiteProduct) =>
    setLines((prev) => [...prev, { productId: p.id, description: p.name, quantity: 1, unitPrice: p.price, discountPct: 0, taxRate: p.taxRate }]);
  const num = (v: string) => (v === "" ? 0 : Number(v));

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="id" value={values.id ?? ""} />
      <input type="hidden" name="clientId" value={clientId ?? ""} />
      <input type="hidden" name="branchId" value={branchId} />
      <input type="hidden" name="globalDiscountPct" value={globalDiscountPct} />
      <input type="hidden" name="notes" value={notes} />
      <input type="hidden" name="items" value={JSON.stringify(lines)} />
      <input type="hidden" name="paymentType" value={paymentType} />

      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className={labelCls}>Cliente</label><ClientPicker clients={clients} value={clientId} onChange={setClientId} /></div>
        {isBackOffice && (
          <div><label className={labelCls}>Sucursal</label>
            <select className={inputCls} value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
        <div className="mb-2"><ProductPicker products={products} onPick={addProduct} /></div>
        {lines.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--text-soft)]">Agrega productos a la venta.</p>
        ) : (
          <div className="space-y-2">
            <div className="hidden grid-cols-12 gap-2 px-1 text-xs text-[var(--text-soft)] lg:grid">
              <span className="col-span-4">Producto</span><span className="col-span-2">Cant.</span>
              <span className="col-span-2">Precio</span><span className="col-span-1">Desc%</span>
              <span className="col-span-1">IVA%</span><span className="col-span-2 text-right">Neto</span>
            </div>
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-12 items-center gap-2">
                <input className={`${cell} col-span-4`} value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} />
                <input className={`${cell} col-span-2`} type="number" step="0.01" min="0" value={l.quantity} onChange={(e) => setLine(i, { quantity: num(e.target.value) })} />
                <input className={`${cell} col-span-2`} type="number" step="0.01" min="0" value={l.unitPrice} onChange={(e) => setLine(i, { unitPrice: num(e.target.value) })} />
                <input className={`${cell} col-span-1`} type="number" step="0.01" min="0" max="100" value={l.discountPct} onChange={(e) => setLine(i, { discountPct: num(e.target.value) })} />
                <input className={`${cell} col-span-1`} type="number" step="0.01" min="0" max="100" value={l.taxRate} onChange={(e) => setLine(i, { taxRate: num(e.target.value) })} />
                <div className="col-span-2 flex items-center justify-end gap-2">
                  <span className="text-sm text-[var(--text)]">{formatMoney(totals.lines[i]?.neto ?? 0, currency)}</span>
                  <button type="button" onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))} className="text-[var(--text-soft)] hover:text-[#dc2626]">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className={labelCls}>Notas</label><textarea className={inputCls} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 text-sm">
          <Row label="Subtotal" value={formatMoney(totals.subtotal, currency)} />
          <div className="flex items-center justify-between py-1">
            <span className="text-[var(--text-soft)]">Descuento global %</span>
            <input className={`${cell} w-20 text-right`} type="number" step="0.01" min="0" max="100" value={globalDiscountPct} onChange={(e) => setGlobalDiscountPct(num(e.target.value))} />
          </div>
          <Row label="Descuentos" value={formatMoney(totals.discountTotal, currency)} />
          <Row label="Impuesto" value={formatMoney(totals.taxTotal, currency)} />
          <div className="mt-1 flex items-center justify-between border-t border-[var(--border)] pt-2 text-base font-bold text-[var(--text)]">
            <span>Total</span><span>{formatMoney(totals.total, currency)}</span>
          </div>
        </div>
      </div>

      {state.error && <p className="text-sm text-[#dc2626]">{state.error}</p>}
      {state.fieldErrors && <p className="text-sm text-[#dc2626]">{Object.values(state.fieldErrors)[0]}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <button name="intent" value="save" disabled={pending}
          className="rounded-[10px] border border-[var(--border)] px-4 py-2.5 text-sm font-semibold text-[var(--text)] disabled:opacity-60">
          {pending ? "Guardando…" : "Guardar borrador"}
        </button>
        <button type="button" onClick={() => setEmitOpen((v) => !v)} disabled={lines.length === 0}
          className="rounded-[10px] bg-gradient-to-br from-[#0e7490] to-[#14b8a6] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
          Emitir
        </button>
      </div>

      {emitOpen && (
        <div className="max-w-md space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-sm font-bold text-[var(--text)]">Emitir venta — {formatMoney(totals.total, currency)}</p>
          <div className="flex gap-2">
            <label className={`flex-1 cursor-pointer rounded-[10px] border px-3 py-2 text-sm ${paymentType === "contado" ? "border-[#0e7490] text-[#0e7490]" : "border-[var(--border)] text-[var(--text)]"}`}>
              <input type="radio" className="mr-2" checked={paymentType === "contado"} onChange={() => setPaymentType("contado")} />Contado
            </label>
            <label className={`flex-1 cursor-pointer rounded-[10px] border px-3 py-2 text-sm ${paymentType === "credito" ? "border-[#0e7490] text-[#0e7490]" : "border-[var(--border)] text-[var(--text)]"}`}>
              <input type="radio" className="mr-2" checked={paymentType === "credito"} onChange={() => setPaymentType("credito")} />Crédito
            </label>
          </div>
          {paymentType === "contado" && (
            <div><label className={labelCls}>Método de pago (opcional)</label>
              <input name="paymentMethod" className={inputCls} placeholder="Efectivo, transferencia…" /></div>
          )}
          <button name="intent" value="emit" disabled={pending}
            className="w-full rounded-[10px] bg-gradient-to-br from-[#0e7490] to-[#14b8a6] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
            {pending ? "Emitiendo…" : "Confirmar emisión"}
          </button>
        </div>
      )}
    </form>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between py-1"><span className="text-[var(--text-soft)]">{label}</span><span className="text-[var(--text)]">{value}</span></div>;
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

- [ ] **Step 3: Commit**

```bash
git add src/components/ventas/sale-builder.tsx
git commit -m "feat(ventas): builder con líneas, totales en vivo y emisión inline (contado/crédito)"
```

---

## Task 14: Documento de venta (detalle reutilizable)

**Files:**
- Create: `src/components/ventas/sale-document.tsx`

- [ ] **Step 1: Implementar**

```tsx
import { formatMoney } from "@/lib/format";
import { SaleStatusBadge } from "./status-badge";

type Item = { id: string; description: string; quantity: number; unit_price: number; discount_pct: number; tax_rate: number };
type Sale = {
  number: number | null; status: string; currency: string; notes: string | null;
  payment_method: string | null; total: number; paid_amount: number;
  clients?: { name: string } | null; branches?: { name: string } | null;
  items: Item[]; computed: { subtotal: number; discountTotal: number; taxTotal: number; total: number; lines: { neto: number }[] };
};

export function SaleDocument({ sale }: { sale: Sale }) {
  const c = sale.currency;
  const balance = Number(sale.total) - Number(sale.paid_amount);
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-lg font-extrabold text-[var(--text)]">{sale.number != null ? `Venta #${sale.number}` : "BORRADOR"}</p>
            <p className="text-sm text-[var(--text-soft)]">{sale.clients?.name ?? "Consumidor final"} · {sale.branches?.name ?? "—"}</p>
          </div>
          <SaleStatusBadge status={sale.status} />
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--text-soft)]">
              <th className="py-1 font-medium">Descripción</th><th className="font-medium">Cant.</th>
              <th className="font-medium">Precio</th><th className="font-medium">Desc%</th><th className="font-medium">IVA%</th>
              <th className="text-right font-medium">Neto</th>
            </tr>
          </thead>
          <tbody>
            {sale.items.map((it, i) => (
              <tr key={it.id} className="border-b border-[var(--border)]">
                <td className="py-1.5 text-[var(--text)]">{it.description}</td>
                <td className="text-[var(--text-soft)]">{Number(it.quantity)}</td>
                <td className="text-[var(--text-soft)]">{formatMoney(Number(it.unit_price), c)}</td>
                <td className="text-[var(--text-soft)]">{Number(it.discount_pct)}%</td>
                <td className="text-[var(--text-soft)]">{Number(it.tax_rate)}%</td>
                <td className="text-right text-[var(--text)]">{formatMoney(sale.computed.lines[i]?.neto ?? 0, c)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-3 ml-auto max-w-xs space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-[var(--text-soft)]">Subtotal</span><span className="text-[var(--text)]">{formatMoney(sale.computed.subtotal, c)}</span></div>
          <div className="flex justify-between"><span className="text-[var(--text-soft)]">Descuentos</span><span className="text-[var(--text)]">{formatMoney(sale.computed.discountTotal, c)}</span></div>
          <div className="flex justify-between"><span className="text-[var(--text-soft)]">Impuesto</span><span className="text-[var(--text)]">{formatMoney(sale.computed.taxTotal, c)}</span></div>
          <div className="flex justify-between border-t border-[var(--border)] pt-1 text-base font-bold text-[var(--text)]"><span>Total</span><span>{formatMoney(sale.computed.total, c)}</span></div>
        </div>
      </div>

      {sale.status === "issued" && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-[var(--text-soft)]">Pago</span>
            <span className="font-medium text-[var(--text)]">
              {balance <= 0 ? `Pagada${sale.payment_method ? ` · ${sale.payment_method}` : ""}` : `Pendiente · saldo ${formatMoney(balance, c)}`}
            </span>
          </div>
          {balance > 0 && <p className="mt-2 text-xs text-[var(--text-soft)]">Los abonos parciales llegan con el módulo de Cobros.</p>}
        </div>
      )}
      {sale.notes && <p className="text-sm text-[var(--text-soft)]">Notas: {sale.notes}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ventas/sale-document.tsx
git commit -m "feat(ventas): componente documento de venta (detalle)"
```

---

## Task 15: Página de lista

**Files:**
- Create: `src/app/(app)/operaciones/facturacion/page.tsx`

- [ ] **Step 1: Implementar**

```tsx
import Link from "next/link";
import { Plus, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { listSales, type SaleStatusFilter, type SalePaymentFilter } from "@/lib/ventas/queries";
import { canSell } from "@/lib/ventas/permissions";
import { SalesToolbar } from "@/components/ventas/sales-toolbar";
import { SalesTable } from "@/components/ventas/sales-table";
import { SaleRowCard } from "@/components/ventas/sale-row-card";
import { EmptyState } from "@/components/shared/empty-state";
import type { Role } from "@/lib/auth/roles";

export default async function FacturacionPage({ searchParams }: {
  searchParams: Promise<{ q?: string; status?: string; payment?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  const { data: mem } = await sb.from("memberships").select("role").eq("user_id", user!.id).single();
  const role = (mem?.role ?? "vendedor") as Role;
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const status = (["borradores", "emitidas", "anuladas", "todas"].includes(sp.status ?? "") ? sp.status : "todas") as SaleStatusFilter;
  const payment = (["pendientes", "todas"].includes(sp.payment ?? "") ? sp.payment : "todas") as SalePaymentFilter;

  const list = await listSales(sb, { search: sp.q ?? "", status, payment, page });
  const pages = Math.max(1, Math.ceil(list.total / list.pageSize));

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold tracking-[-0.4px] text-[var(--text)]">Facturación</h1>
        {canSell(role) && (
          <Link href="/operaciones/facturacion/nueva"
            className="flex items-center gap-1.5 rounded-[10px] bg-gradient-to-br from-[#0e7490] to-[#14b8a6] px-3 py-2 text-sm font-semibold text-white">
            <Plus className="h-4 w-4" strokeWidth={2.5} /> Nueva venta
          </Link>
        )}
      </div>

      <SalesToolbar />

      {list.rows.length === 0 ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
          <EmptyState icon={FileText} title="Aún no hay ventas" hint="Crea la primera con “Nueva venta”." />
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-2 lg:p-4">
          <SalesTable rows={list.rows} />
          <div className="space-y-2 lg:hidden">{list.rows.map((r) => <SaleRowCard key={r.id} r={r} />)}</div>
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
  if (sp.q) params.set("q", sp.q); if (sp.status) params.set("status", sp.status);
  if (sp.payment) params.set("payment", sp.payment); params.set("page", String(page));
  return <Link href={`/operaciones/facturacion?${params.toString()}`} className="rounded px-2 text-[var(--text)] hover:bg-[var(--bg)]">{children}</Link>;
}
```

- [ ] **Step 2: Commit**

```bash
git add "src/app/(app)/operaciones/facturacion/page.tsx"
git commit -m "feat(ventas): página de lista con búsqueda/filtros/paginación"
```

---

## Task 16: Páginas nueva + editar

**Files:**
- Create: `src/app/(app)/operaciones/facturacion/nueva/page.tsx`
- Create: `src/app/(app)/operaciones/facturacion/[id]/editar/page.tsx`

- [ ] **Step 1: Helper compartido de datos del builder — inline en cada página**

Ambas páginas cargan clientes/productos/sucursales/moneda/rol/branch. Nueva:

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTenantCurrency } from "@/lib/productos/queries";
import { listActiveClientsLite, listActiveProductsLite, listBranches } from "@/lib/ventas/queries";
import { canSell } from "@/lib/ventas/permissions";
import { SaleBuilder } from "@/components/ventas/sale-builder";
import type { Role } from "@/lib/auth/roles";

export default async function NuevaVentaPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  const { data: mem } = await sb.from("memberships").select("role, branch_id").eq("user_id", user!.id).single();
  const role = (mem?.role ?? "vendedor") as Role;
  if (!canSell(role)) redirect("/dashboard");

  const [clients, products, branches, currency] = await Promise.all([
    listActiveClientsLite(sb), listActiveProductsLite(sb), listBranches(sb), getTenantCurrency(sb),
  ]);

  return (
    <div className="p-6">
      <h1 className="mb-4 text-xl font-extrabold tracking-[-0.4px] text-[var(--text)]">Nueva venta</h1>
      <SaleBuilder clients={clients} products={products} branches={branches}
        role={role} userBranchId={mem?.branch_id ?? null} currency={currency} />
    </div>
  );
}
```

- [ ] **Step 2: Editar (`[id]/editar/page.tsx`)**

```tsx
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTenantCurrency } from "@/lib/productos/queries";
import { getSale, listActiveClientsLite, listActiveProductsLite, listBranches } from "@/lib/ventas/queries";
import { canSell } from "@/lib/ventas/permissions";
import { SaleBuilder } from "@/components/ventas/sale-builder";
import type { Role } from "@/lib/auth/roles";

export default async function EditarVentaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  const { data: mem } = await sb.from("memberships").select("role, branch_id").eq("user_id", user!.id).single();
  const role = (mem?.role ?? "vendedor") as Role;
  if (!canSell(role)) redirect("/dashboard");

  const [sale, clients, products, branches, currency] = await Promise.all([
    getSale(sb, id), listActiveClientsLite(sb), listActiveProductsLite(sb), listBranches(sb), getTenantCurrency(sb),
  ]);
  if (!sale) notFound();
  if (sale.status !== "draft") redirect(`/operaciones/facturacion/${id}`);

  const items = (sale.items as any[]).map((it) => ({
    productId: it.product_id ?? null, description: it.description, quantity: Number(it.quantity),
    unitPrice: Number(it.unit_price), discountPct: Number(it.discount_pct), taxRate: Number(it.tax_rate),
  }));

  return (
    <div className="p-6">
      <h1 className="mb-4 text-xl font-extrabold tracking-[-0.4px] text-[var(--text)]">Editar borrador</h1>
      <SaleBuilder clients={clients} products={products} branches={branches}
        role={role} userBranchId={mem?.branch_id ?? null} currency={currency}
        values={{ id: sale.id, clientId: sale.client_id, branchId: sale.branch_id,
          globalDiscountPct: Number(sale.global_discount_pct), notes: sale.notes ?? "", items }} />
    </div>
  );
}
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/operaciones/facturacion/nueva/page.tsx" "src/app/(app)/operaciones/facturacion/[id]/editar/page.tsx"
git commit -m "feat(ventas): páginas nueva venta y editar borrador"
```

---

## Task 17: Página de detalle

**Files:**
- Create: `src/app/(app)/operaciones/facturacion/[id]/page.tsx`

- [ ] **Step 1: Implementar**

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSale } from "@/lib/ventas/queries";
import { canVoidSale } from "@/lib/ventas/permissions";
import { deleteDraftAction, voidSaleAction } from "@/app/(app)/operaciones/facturacion/actions";
import { SaleDocument } from "@/components/ventas/sale-document";
import type { Role } from "@/lib/auth/roles";

export default async function VentaDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createClient();
  const sale = await getSale(sb, id);
  if (!sale) notFound();
  const { data: { user } } = await sb.auth.getUser();
  const { data: mem } = await sb.from("memberships").select("role").eq("user_id", user!.id).single();
  const role = (mem?.role ?? "vendedor") as Role;

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/operaciones/facturacion" className="text-sm text-[var(--text-soft)] hover:text-[#0e7490]">← Ventas</Link>
        <div className="flex items-center gap-2">
          {sale.status === "draft" && (
            <>
              <Link href={`/operaciones/facturacion/${sale.id}/editar`}
                className="flex items-center gap-1.5 rounded-[10px] border border-[var(--border)] px-3 py-2 text-sm text-[var(--text)]">
                <Pencil className="h-4 w-4" /> Editar
              </Link>
              <form action={deleteDraftAction}>
                <input type="hidden" name="id" value={sale.id} />
                <button className="rounded-[10px] border border-[var(--border)] px-3 py-2 text-sm text-[#dc2626]">Eliminar borrador</button>
              </form>
            </>
          )}
          {sale.status === "issued" && canVoidSale(role) && (
            <form action={voidSaleAction}>
              <input type="hidden" name="id" value={sale.id} />
              <input type="hidden" name="clientId" value={sale.client_id ?? ""} />
              <button className="rounded-[10px] border border-[var(--border)] px-3 py-2 text-sm text-[#dc2626]">Anular</button>
            </form>
          )}
        </div>
      </div>

      <SaleDocument sale={sale as any} />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add "src/app/(app)/operaciones/facturacion/[id]/page.tsx"
git commit -m "feat(ventas): página de detalle con acciones por estado/rol"
```

---

## Task 18: Detalle de Cliente — Historial + Por cobrar

**Files:**
- Modify: `src/app/(app)/clientes/[id]/page.tsx`

- [ ] **Step 1: Añadir imports y carga de datos**

En `src/app/(app)/clientes/[id]/page.tsx`, añadir el import junto a los existentes:

```typescript
import Link from "next/link";
import { salesByClient } from "@/lib/ventas/queries";
import { formatMoney } from "@/lib/format";
import { getTenantCurrency } from "@/lib/productos/queries";
```

(Si `Link` ya está importado, no lo dupliques.) Después de obtener `c` (el cliente) y antes del `return`, cargar:

```typescript
  const [history, currency] = await Promise.all([salesByClient(sb, c.id), getTenantCurrency(sb)]);
```

- [ ] **Step 2: Reemplazar el bloque de empty states**

Reemplazar el bloque existente:

```tsx
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
          <EmptyState icon={ShoppingBag} title="Historial de compras" hint="Llega con el módulo de Facturación." />
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
          <EmptyState icon={Wallet} title="Por cobrar" hint="Llega con el módulo de Facturación." />
        </div>
      </div>
```

por:

```tsx
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-bold text-[var(--text)]">Historial de compras</p>
            {history.purchasedTotal > 0 && <span className="text-xs text-[var(--text-soft)]">{formatMoney(history.purchasedTotal, currency)}</span>}
          </div>
          {history.list.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--text-soft)]">Sin compras registradas.</p>
          ) : (
            <ul className="space-y-2">
              {history.list.map((s) => (
                <li key={s.id} className="flex items-center justify-between text-sm">
                  <Link href={`/operaciones/facturacion/${s.id}`} className="text-[var(--text)] hover:text-[#0e7490]">
                    Venta #{s.number} · {s.issuedAt ? new Date(s.issuedAt).toLocaleDateString("es-VE") : "—"}
                  </Link>
                  <span className="font-medium text-[var(--text)]">{formatMoney(s.total, currency)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="mb-3 text-sm font-bold text-[var(--text)]">Por cobrar</p>
          {history.receivable > 0
            ? <p className="text-2xl font-extrabold text-[#dc2626]">{formatMoney(history.receivable, currency)}</p>
            : <p className="py-6 text-center text-sm text-[var(--text-soft)]">Sin saldos pendientes.</p>}
        </div>
      </div>
```

- [ ] **Step 3: Limpiar imports muertos**

Si tras el reemplazo `ShoppingBag`/`Wallet`/`EmptyState` ya no se usan en el archivo, elimínalos del import de `lucide-react`/shared. Verificar con:

Run: `npx tsc --noEmit`
Expected: sin errores nuevos (ni "declared but never used" si el proyecto lo trata como error; si es solo warning, igual límpialos).

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/clientes/[id]/page.tsx"
git commit -m "feat(ventas): detalle de cliente con Historial de compras y Por cobrar reales"
```

---

## Task 19: Dashboard — Ventas del mes / Ticket promedio / Por cobrar

**Files:**
- Modify: `src/app/(app)/dashboard/page.tsx`

- [ ] **Step 1: Imports**

Añadir junto a los imports existentes del dashboard:

```typescript
import { salesKpi, receivablesTotal } from "@/lib/ventas/queries";
import { getTenantCurrency } from "@/lib/productos/queries";
import { formatMoney } from "@/lib/format";
```

- [ ] **Step 2: Cargar datos**

Reemplazar la línea del `Promise.all` existente:

```typescript
  const [kpi, byType, prodKpi, byCategory] = await Promise.all([
    clientsKpi(supabase), clientsByType(supabase), productsKpi(supabase), productsByCategory(supabase),
  ]);
```

por:

```typescript
  const [kpi, byType, prodKpi, byCategory, sKpi, recv, currency] = await Promise.all([
    clientsKpi(supabase), clientsByType(supabase), productsKpi(supabase), productsByCategory(supabase),
    salesKpi(supabase), receivablesTotal(supabase), getTenantCurrency(supabase),
  ]);
  const ventasMes = sKpi.monthTotal > 0 ? { value: formatMoney(sKpi.monthTotal, currency) } : {};
  const ticket = sKpi.avgTicket > 0 ? { value: formatMoney(sKpi.avgTicket, currency) } : {};
  const porCobrar = recv.total > 0 ? { value: formatMoney(recv.total, currency) } : {};
```

- [ ] **Step 3: Pasar valores a las KpiCard (móvil y escritorio)**

En el bloque móvil, cambiar:

```tsx
        <KpiCard icon={DollarSign} label="Ventas del mes" />
```
por:
```tsx
        <KpiCard icon={DollarSign} label="Ventas del mes" value={ventasMes.value} />
```
y:
```tsx
        <KpiCard icon={ArrowDownCircle} label="Por cobrar" />
```
por:
```tsx
        <KpiCard icon={ArrowDownCircle} label="Por cobrar" value={porCobrar.value} />
```

En el bloque escritorio, cambiar las mismas dos líneas igual que arriba, y además:

```tsx
        <KpiCard icon={Receipt} label="Ticket promedio" />
```
por:
```tsx
        <KpiCard icon={Receipt} label="Ticket promedio" value={ticket.value} />
```

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/dashboard/page.tsx"
git commit -m "feat(ventas): dashboard con Ventas del mes, Ticket promedio y Por cobrar reales"
```

---

## Task 20: Cablear el FAB "Vender"

**Files:**
- Modify: `src/components/shell/fab-vender.tsx`
- Modify: `src/components/shell/mobile-bottom-nav.tsx`

- [ ] **Step 1: FAB → nueva venta**

En `src/components/shell/fab-vender.tsx`, cambiar la navegación y quitar el comentario placeholder:

```tsx
    <button aria-label="Vender" onClick={() => router.push("/operaciones/facturacion/nueva")}
```
(elimina la línea de comentario `// Acción placeholder…`).

- [ ] **Step 2: Botón central "+" de la barra inferior → nueva venta**

En `src/components/shell/mobile-bottom-nav.tsx`, en el botón central squircle, cambiar:

```tsx
        <button aria-label="Vender" onClick={() => router.push("/operaciones/facturacion")}
```
por:
```tsx
        <button aria-label="Vender" onClick={() => router.push("/operaciones/facturacion/nueva")}
```
(La pestaña "Vender" de la izquierda `Item href="/operaciones/facturacion"` se deja apuntando a la lista.)

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

- [ ] **Step 4: Commit**

```bash
git add src/components/shell/fab-vender.tsx src/components/shell/mobile-bottom-nav.tsx
git commit -m "feat(ventas): FAB y botón central Vender navegan a nueva venta"
```

---

## Task 21: Verificación final

**Files:** ninguno (solo verificación).

- [ ] **Step 1: Suite completa de tests**

Run: `npx vitest run`
Expected: PASS todos (los previos + `totals`/`permissions`/`schema`/`ventas` nuevos).

- [ ] **Step 2: Build de producción**

Run: `npm run build`
Expected: build exitoso, sin errores de tipos ni compilación.

- [ ] **Step 3: E2E manual (checklist)**

Levantar `npm run dev`. Como **owner**:
- `/operaciones/facturacion` empty state; "Nueva venta" visible.
- Crear venta: elegir cliente (o Consumidor final), agregar productos (prefill precio/IVA), editar cantidad/precio/desc%/IVA%, descuento global; totales en vivo cuadran.
- "Guardar borrador" → detalle como BORRADOR; editar; volver.
- "Emitir" → Contado (con método) y en otra venta Crédito; el detalle muestra Nº, Pagada/Pendiente + saldo.
- Lista: buscar por número y por cliente, filtros estado/pago, paginación.
- Anular una emitida (owner) → chip Anulada; sale de "por cobrar".
- Detalle de Cliente: Historial de compras + Por cobrar reales.
- Dashboard: Ventas del mes, Ticket promedio, Por cobrar con montos reales.
- FAB "Vender" y botón central "+" → `/operaciones/facturacion/nueva`.

Role-gating con usuarios de prueba (crear en `/configuracion/usuarios`):
- **almacen:** sin botón "Nueva venta"; si entra a `/operaciones/facturacion/nueva` por URL → redirige a `/dashboard`; RLS niega insertar ventas.
- **vendedor** de una sucursal: no ve el botón "Anular"; solo ve ventas de su sucursal (crear una venta como owner en otra sucursal y confirmar que ese vendedor no la lista).

- [ ] **Step 4: Commit final (si hubo ajustes)**

```bash
git add -A
git commit -m "chore(ventas): ajustes finales tras verificación E2E"
```

---

## Notas de cierre

- **DRY:** reusa `formatMoney`, `getTenantCurrency`, `EmptyState`, `KpiCard`, el patrón `ctx()`/`FormState`/`zodErrors`. No dupliques.
- **YAGNI:** nada de abonos parciales, PDF, stock, utilidad, presupuestos ni multi-moneda (ver "Fuera de alcance" del spec).
- **Seguridad:** la barrera dura es RLS (aislamiento tenant + scoping sucursal en `sales` y `sale_items`) + chequeo de rol en Server Actions; la UI solo oculta. El correlativo es gapless vía RPC `next_sale_number` (SECURITY DEFINER, atómico).
- **PWA:** el panel de emisión es in-app (no `confirm`/`prompt` nativos), coherente con la lección de diálogos nativos en PWA.
- **AGENTS.md:** esta versión de Next.js tiene cambios; ante APIs de framework, consulta `node_modules/next/dist/docs/`. `params`/`searchParams` son Promises (por eso el `await`).
- **Finish:** con la suite verde + build limpio, usar `superpowers:finishing-a-development-branch` para el merge a `master`.
```
