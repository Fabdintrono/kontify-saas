# Kontify — Inventario / Núcleo de Stock (Plan 7) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Existencias por producto×sucursal (solo `good`), movimientos (ajustes + descuento automático al emitir ventas y reposición al anular), stock mínimo por producto, y dashboard/reporte de valorización; con stock negativo permitido.

**Architecture:** Ledger `stock_movements` append-only + caché `stock_levels` mantenida por trigger atómico (mismo patrón que `paid_amount` de Cobros). RLS laxo en INSERT de movimientos (para que el descuento por venta lo cree el vendedor) + barrera de ajustes manuales en la Server Action (`canManageStock`). Integración vía helpers llamados desde `emitSale`/`voidSale`. Espeja el patrón de los módulos previos.

**Tech Stack:** Next.js (custom — ver `AGENTS.md`), RSC + Server Actions + `useActionState`, Supabase (Postgres + RLS + trigger), Zod, Vitest, Tailwind 4.

**Prerequisito de entorno:** Supabase local corriendo (`npx supabase start`). Migraciones/tests con `npx supabase db reset`.

**Referencia viva:** `src/lib/cobros/*` (trigger + RLS laxo + barrera), `src/lib/ventas/*`, `src/lib/productos/*` y sus UI son la plantilla. NO refactorizar. Reusar `formatMoney`, `getTenantCurrency`, `EmptyState`, patrón `ctx()`/`FormState`/`zodErrors`, `canManageProducts` de `@/lib/productos/permissions`.

---

## Estructura de archivos

**Migraciones (crear):** `0020_stock_schema.sql`, `0021_stock_rls.sql`, `0022_stock_trigger.sql`.

**Capa de datos (crear):** `src/lib/inventario/permissions.ts`, `schema.ts`, `mutations.ts`, `queries.ts`.

**Modificar:**
- `src/lib/ventas/mutations.ts` — `emitSale` llama `applySaleStockOut`, `voidSale` llama `reverseSaleStock`.
- `src/lib/productos/schema.ts` — `minStock` en el schema.
- `src/lib/productos/mutations.ts` — `productRow` mapea `min_stock`.
- `src/app/(app)/operaciones/productos/actions.ts` — `productFields` incluye `minStock`.
- `src/components/productos/product-form.tsx` — campo Stock mínimo.
- `src/app/(app)/operaciones/productos/[id]/editar/page.tsx` — pasa `minStock`.
- `src/app/(app)/operaciones/productos/[id]/page.tsx` — reemplaza el empty state por el panel de stock.
- `src/lib/nav.ts` — item "Inventario" en Operaciones.
- `src/app/(app)/reportes/inventario/page.tsx` — reporte de valorización (reemplaza placeholder).
- `src/app/(app)/dashboard/page.tsx` — Valor de inventario / Bajo stock / Estado del inventario.

**Server Actions (crear):** `src/app/(app)/operaciones/inventario/actions.ts`.

**UI (crear):** `src/components/inventario/{stock-status-badge,stock-table,stock-row-card,stock-toolbar,movements-history,stock-adjust-form,product-stock-panel}.tsx`; `src/app/(app)/operaciones/inventario/page.tsx`.

**Tests (crear):** `src/lib/inventario/permissions.test.ts`, `schema.test.ts`, `tests/inventario.test.ts`.

---

## Task 1: Migración — schema

**Files:**
- Create: `supabase/migrations/0020_stock_schema.sql`

- [ ] **Step 1: Escribir la migración**

```sql
-- 0020_stock_schema.sql
create type public.stock_movement_type as enum ('adjustment','sale','sale_void');

alter table public.products add column min_stock numeric(14,2) not null default 0;

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  branch_id uuid not null references public.branches(id) on delete restrict,
  qty_delta numeric(14,2) not null,
  type public.stock_movement_type not null,
  sale_id uuid references public.sales(id) on delete set null,
  reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index stock_movements_tenant_product on public.stock_movements (tenant_id, product_id);
create index stock_movements_branch on public.stock_movements (branch_id);
create index stock_movements_sale on public.stock_movements (sale_id);

create table public.stock_levels (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  qty numeric(14,2) not null default 0,
  primary key (product_id, branch_id)
);
create index stock_levels_tenant on public.stock_levels (tenant_id);
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/0020_stock_schema.sql
git commit -m "feat(inventario): migración schema (stock_movements, stock_levels, products.min_stock)"
```

---

## Task 2: Migración — RLS + grants

**Files:**
- Create: `supabase/migrations/0021_stock_rls.sql`

- [ ] **Step 1: Escribir la migración**

```sql
-- 0021_stock_rls.sql
alter table public.stock_movements enable row level security;
alter table public.stock_levels    enable row level security;

-- movimientos: SELECT scopeado por sucursal; INSERT laxo (los 6 roles, para el descuento por venta).
-- Sin UPDATE/DELETE (ledger append-only). La barrera de ajustes manuales vive en la Server Action.
create policy stock_movements_select on public.stock_movements
  for select using (tenant_id = public.current_tenant_id()
    and ( public.current_user_role() in ('owner','admin','administrativo')
          or branch_id = public.current_user_branch_id() ));
create policy stock_movements_insert on public.stock_movements
  for insert with check (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin','administrativo','vendedor','cajero','almacen'));

-- niveles: solo lectura scopeada; los escribe el trigger (SECURITY DEFINER).
create policy stock_levels_select on public.stock_levels
  for select using (tenant_id = public.current_tenant_id()
    and ( public.current_user_role() in ('owner','admin','administrativo')
          or branch_id = public.current_user_branch_id() ));

grant select, insert on public.stock_movements to authenticated;
grant select on public.stock_levels to authenticated;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/0021_stock_rls.sql
git commit -m "feat(inventario): RLS (movimientos insert laxo + niveles solo lectura, scoping sucursal)"
```

---

## Task 3: Migración — trigger

**Files:**
- Create: `supabase/migrations/0022_stock_trigger.sql`

- [ ] **Step 1: Escribir la migración**

```sql
-- 0022_stock_trigger.sql
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

- [ ] **Step 2: Aplicar migraciones**

Run: `npx supabase db reset`
Expected: sin error; en el log aparecen `0020`, `0021`, `0022`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0022_stock_trigger.sql
git commit -m "feat(inventario): trigger apply_stock_movement (stock_levels derivado, atómico)"
```

---

## Task 4: permissions.ts (TDD)

**Files:**
- Create: `src/lib/inventario/permissions.ts`
- Test: `src/lib/inventario/permissions.test.ts`

- [ ] **Step 1: Escribir el test que falla**

```typescript
import { describe, it, expect } from "vitest";
import { canManageStock } from "./permissions";

describe("inventario — permissions", () => {
  it("canManageStock: almacén + back-office; vendedor/cajero no", () => {
    expect(["owner", "admin", "administrativo", "almacen"].every(canManageStock as any)).toBe(true);
    expect(canManageStock("vendedor")).toBe(false);
    expect(canManageStock("cajero")).toBe(false);
  });
});
```

- [ ] **Step 2: Correr el test — debe fallar**

Run: `npx vitest run src/lib/inventario/permissions.test.ts`
Expected: FAIL (no existe `./permissions`).

- [ ] **Step 3: Implementar**

```typescript
import type { Role } from "@/lib/auth/roles";

const MANAGE: Role[] = ["owner", "admin", "administrativo", "almacen"];
export const canManageStock = (role: Role): boolean => MANAGE.includes(role);
```

- [ ] **Step 4: Correr el test — debe pasar**

Run: `npx vitest run src/lib/inventario/permissions.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/inventario/permissions.ts src/lib/inventario/permissions.test.ts
git commit -m "feat(inventario): helper canManageStock con test"
```

---

## Task 5: schema.ts (TDD)

**Files:**
- Create: `src/lib/inventario/schema.ts`
- Test: `src/lib/inventario/schema.test.ts`

- [ ] **Step 1: Escribir el test que falla**

```typescript
import { describe, it, expect } from "vitest";
import { adjustmentSchema } from "./schema";

const pid = "11111111-1111-1111-1111-111111111111";
const bid = "22222222-2222-2222-2222-222222222222";

describe("inventario — schema", () => {
  it("acepta un ajuste válido y castea quantity", () => {
    const r = adjustmentSchema.safeParse({ productId: pid, branchId: bid, direction: "in", quantity: "5" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.quantity).toBe(5);
  });
  it("rechaza quantity <= 0 y direction inválida", () => {
    expect(adjustmentSchema.safeParse({ productId: pid, branchId: bid, direction: "out", quantity: 0 }).success).toBe(false);
    expect(adjustmentSchema.safeParse({ productId: pid, branchId: bid, direction: "x", quantity: 1 }).success).toBe(false);
  });
  it("exige productId y branchId", () => {
    expect(adjustmentSchema.safeParse({ direction: "in", quantity: 1 }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Correr el test — debe fallar**

Run: `npx vitest run src/lib/inventario/schema.test.ts`
Expected: FAIL (no existe `./schema`).

- [ ] **Step 3: Implementar**

```typescript
import { z } from "zod";

const optStr = (max: number) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().max(max).optional());

export const adjustmentSchema = z.object({
  productId: z.string().guid("Producto requerido"),
  branchId: z.string().guid("Sucursal requerida"),
  direction: z.enum(["in", "out"], { message: "Dirección inválida" }),
  quantity: z.coerce.number().positive("La cantidad debe ser mayor a 0"),
  reason: optStr(200),
});
export type AdjustmentInput = z.infer<typeof adjustmentSchema>;
```

- [ ] **Step 4: Correr el test — debe pasar**

Run: `npx vitest run src/lib/inventario/schema.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/inventario/schema.ts src/lib/inventario/schema.test.ts
git commit -m "feat(inventario): esquema Zod del ajuste con test"
```

---

## Task 6: mutations.ts

**Files:**
- Create: `src/lib/inventario/mutations.ts`

(Se ejercita en los tests de integración de la Task 10.)

- [ ] **Step 1: Implementar**

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdjustmentInput } from "@/lib/inventario/schema";

export async function registerAdjustment(
  sb: SupabaseClient, tenantId: string, userId: string, input: AdjustmentInput,
): Promise<string> {
  const qtyDelta = input.direction === "in" ? input.quantity : -input.quantity;
  const { data, error } = await sb.from("stock_movements").insert({
    tenant_id: tenantId, product_id: input.productId, branch_id: input.branchId,
    qty_delta: qtyDelta, type: "adjustment", reason: input.reason ?? null, created_by: userId,
  }).select("id").single();
  if (error) throw error;
  return data.id as string;
}

// Lee los ítems 'good' de la venta y genera un movimiento por cada uno. `sign` = -1 (salida) o +1 (reposición).
async function saleMovements(sb: SupabaseClient, saleId: string, sign: 1 | -1, type: "sale" | "sale_void") {
  const { data: sale, error: sErr } = await sb.from("sales")
    .select("tenant_id, branch_id, created_by").eq("id", saleId).maybeSingle();
  if (sErr) throw sErr;
  if (!sale) return;
  const { data: items, error: iErr } = await sb.from("sale_items")
    .select("product_id, quantity, products(kind)").eq("sale_id", saleId).not("product_id", "is", null);
  if (iErr) throw iErr;
  const rows = (items ?? [])
    .filter((it: any) => it.products?.kind === "good")
    .map((it: any) => ({
      tenant_id: sale.tenant_id, product_id: it.product_id, branch_id: sale.branch_id,
      qty_delta: sign * Number(it.quantity), type, sale_id: saleId, created_by: sale.created_by,
    }));
  if (rows.length === 0) return;
  const { error } = await sb.from("stock_movements").insert(rows);
  if (error) throw error;
}

export async function applySaleStockOut(sb: SupabaseClient, saleId: string): Promise<void> {
  await saleMovements(sb, saleId, -1, "sale");
}

export async function reverseSaleStock(sb: SupabaseClient, saleId: string): Promise<void> {
  await saleMovements(sb, saleId, 1, "sale_void");
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/inventario/mutations.ts
git commit -m "feat(inventario): mutaciones (ajuste manual + movimientos por venta)"
```

---

## Task 7: queries.ts

**Files:**
- Create: `src/lib/inventario/queries.ts`

- [ ] **Step 1: Implementar**

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";
import { round2 } from "@/lib/ventas/totals";

export type StockStatus = "en_stock" | "bajo" | "agotado";
export type StockRow = { productId: string; name: string; sku: string | null; qty: number; minStock: number; status: StockStatus };

function statusOf(qty: number, minStock: number): StockStatus {
  if (qty <= 0) return "agotado";
  if (qty <= minStock) return "bajo";
  return "en_stock";
}
function sanitize(term: string): string { return term.replace(/[%,()*]/g, " ").trim(); }

export async function listStock(sb: SupabaseClient, opts: {
  search?: string; status?: "todos" | "bajo" | "agotado"; branchId?: string | null;
} = {}): Promise<StockRow[]> {
  try {
    const { search = "", status = "todos", branchId = null } = opts;
    const { data: products } = await sb.from("products")
      .select("id, name, sku, min_stock").eq("kind", "good").eq("active", true).order("name");
    let lq = sb.from("stock_levels").select("product_id, branch_id, qty");
    if (branchId) lq = lq.eq("branch_id", branchId);
    const { data: levels } = await lq;
    const byProduct = new Map<string, number>();
    for (const l of (levels ?? []) as any[]) byProduct.set(l.product_id, (byProduct.get(l.product_id) ?? 0) + Number(l.qty));

    const s = sanitize(search).toLowerCase();
    let rows: StockRow[] = (products ?? []).map((p: any) => {
      const qty = round2(byProduct.get(p.id) ?? 0);
      const minStock = Number(p.min_stock);
      return { productId: p.id, name: p.name, sku: p.sku, qty, minStock, status: statusOf(qty, minStock) };
    });
    if (s) rows = rows.filter((r) => r.name.toLowerCase().includes(s) || (r.sku ?? "").toLowerCase().includes(s));
    if (status === "bajo") rows = rows.filter((r) => r.status === "bajo");
    else if (status === "agotado") rows = rows.filter((r) => r.status === "agotado");
    return rows;
  } catch { return []; }
}

export async function getProductStock(sb: SupabaseClient, productId: string): Promise<{
  levels: { branchId: string; branchName: string | null; qty: number }[]; minStock: number;
}> {
  try {
    const { data: prod } = await sb.from("products").select("min_stock").eq("id", productId).maybeSingle();
    const { data } = await sb.from("stock_levels").select("branch_id, qty, branches(name)").eq("product_id", productId);
    const levels = (data ?? []).map((l: any) => ({ branchId: l.branch_id, branchName: l.branches?.name ?? null, qty: Number(l.qty) }));
    return { levels, minStock: prod ? Number(prod.min_stock) : 0 };
  } catch { return { levels: [], minStock: 0 }; }
}

export async function listMovements(sb: SupabaseClient, productId: string, opts: { limit?: number } = {}): Promise<{
  id: string; type: string; qtyDelta: number; branchName: string | null; reason: string | null; createdAt: string;
}[]> {
  const { data } = await sb.from("stock_movements")
    .select("id, type, qty_delta, reason, created_at, branches(name)")
    .eq("product_id", productId).order("created_at", { ascending: false }).limit(opts.limit ?? 20);
  return (data ?? []).map((m: any) => ({ id: m.id, type: m.type, qtyDelta: Number(m.qty_delta), branchName: m.branches?.name ?? null, reason: m.reason, createdAt: m.created_at }));
}

async function goodLevels(sb: SupabaseClient) {
  const { data, error } = await sb.from("stock_levels").select("qty, products(cost, min_stock, kind, active)");
  if (error || !data) return null;
  return (data as any[]).filter((l) => l.products?.kind === "good" && l.products?.active);
}

export async function stockKpi(sb: SupabaseClient): Promise<{ value: number; lowCount: number; outCount: number }> {
  try {
    const rows = await goodLevels(sb);
    if (!rows) return { value: 0, lowCount: 0, outCount: 0 };
    let value = 0, lowCount = 0, outCount = 0;
    for (const l of rows) {
      const qty = Number(l.qty), cost = Number(l.products.cost ?? 0), min = Number(l.products.min_stock);
      value += qty * cost;
      if (qty <= 0) outCount++; else if (qty <= min) lowCount++;
    }
    return { value: round2(value), lowCount, outCount };
  } catch { return { value: 0, lowCount: 0, outCount: 0 }; }
}

export async function inventoryStatusBreakdown(sb: SupabaseClient): Promise<{ inStock: number; low: number; out: number }> {
  try {
    const rows = await goodLevels(sb);
    if (!rows) return { inStock: 0, low: 0, out: 0 };
    let inStock = 0, low = 0, out = 0;
    for (const l of rows) {
      const qty = Number(l.qty), min = Number(l.products.min_stock);
      if (qty <= 0) out++; else if (qty <= min) low++; else inStock++;
    }
    return { inStock, low, out };
  } catch { return { inStock: 0, low: 0, out: 0 }; }
}

export async function inventoryValuation(sb: SupabaseClient, opts: { branchId?: string | null } = {}): Promise<{
  total: number; rows: { productId: string; name: string; branchName: string | null; qty: number; cost: number; value: number }[];
}> {
  try {
    let q = sb.from("stock_levels").select("product_id, branch_id, qty, products(name, cost, kind, active), branches(name)");
    if (opts.branchId) q = q.eq("branch_id", opts.branchId);
    const { data, error } = await q;
    if (error || !data) return { total: 0, rows: [] };
    const rows = (data as any[])
      .filter((l) => l.products?.kind === "good" && l.products?.active)
      .map((l) => {
        const qty = Number(l.qty), cost = Number(l.products.cost ?? 0);
        return { productId: l.product_id, name: l.products.name, branchName: l.branches?.name ?? null, qty, cost, value: round2(qty * cost) };
      })
      .sort((a, b) => b.value - a.value);
    return { total: round2(rows.reduce((s, r) => s + r.value, 0)), rows };
  } catch { return { total: 0, rows: [] }; }
}
```

- [ ] **Step 2: Verificar tipos + commit**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

```bash
git add src/lib/inventario/queries.ts
git commit -m "feat(inventario): queries (stock, movimientos, kpi, breakdown, valorización)"
```

---

## Task 8: Integración con Ventas (emit/void descuentan y reponen stock)

**Files:**
- Modify: `src/lib/ventas/mutations.ts`

- [ ] **Step 1: Importar los helpers de inventario**

En `src/lib/ventas/mutations.ts`, añadir junto a los imports existentes (arriba del archivo):

```typescript
import { applySaleStockOut, reverseSaleStock } from "@/lib/inventario/mutations";
```

- [ ] **Step 2: `emitSale` descuenta stock**

En `emitSale`, al FINAL de la función (después del bloque `if (payment.paymentType === "contado") { ... }`), añadir antes del cierre `}`:

```typescript
  // Descuenta stock de los ítems 'good' de la venta (permite negativo).
  await applySaleStockOut(sb, id);
```

- [ ] **Step 3: `voidSale` repone stock**

En `voidSale`, después del guard final (`if (!data || data.length === 0) throw new Error("Solo se anulan ventas emitidas");`), añadir antes del cierre `}`:

```typescript
  await reverseSaleStock(sb, id);
```

- [ ] **Step 4: Aplicar migraciones y correr regresión**

Run: `npx supabase db reset && npx vitest run tests/ventas.test.ts tests/cobros.test.ts src/lib/ventas/`
Expected: PASS (las ventas ahora crean movimientos de stock además de los cobros; los tests previos siguen verdes).

- [ ] **Step 5: Verificar tipos + commit**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

```bash
git add src/lib/ventas/mutations.ts
git commit -m "feat(inventario): emitSale descuenta stock y voidSale lo repone"
```

---

## Task 9: Productos — campo min_stock

**Files:**
- Modify: `src/lib/productos/schema.ts`, `src/lib/productos/mutations.ts`, `src/app/(app)/operaciones/productos/actions.ts`, `src/components/productos/product-form.tsx`, `src/app/(app)/operaciones/productos/[id]/editar/page.tsx`

- [ ] **Step 1: Schema — añadir `minStock`**

En `src/lib/productos/schema.ts`, dentro de `productCreateSchema`, añadir el campo `minStock` (después de `taxRateId`):

```typescript
  taxRateId: optId,
  minStock: reqNum,
```

(`reqNum` ya existe en el archivo: preprocesa vacío→0 y valida `≥ 0`.)

- [ ] **Step 2: Mutación — mapear `min_stock`**

En `src/lib/productos/mutations.ts`, en `productRow`, añadir la línea (después de `unit`):

```typescript
  unit: input.unit,
  min_stock: input.minStock,
```

- [ ] **Step 3: Server Action — leer `minStock` del form**

En `src/app/(app)/operaciones/productos/actions.ts`, en `productFields`, añadir:

```typescript
  cost: fd.get("cost"), taxRateId: fd.get("taxRateId"), minStock: fd.get("minStock"),
```

- [ ] **Step 4: Form — campo Stock mínimo**

En `src/components/productos/product-form.tsx`:

Primero, añadir `minStock` al tipo `Values`:

```typescript
type Values = {
  id?: string; kind?: "good" | "service"; name?: string; sku?: string; description?: string;
  unit?: string; categoryId?: string | null; price?: string; cost?: string; taxRateId?: string | null; minStock?: string;
};
```

Luego, después del bloque de la grilla de Precio/Costo (el `<div className="grid grid-cols-2 gap-3">` que contiene Precio y Costo), añadir:

```tsx
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Stock mínimo</label>
          <input name="minStock" type="number" step="0.01" min="0" defaultValue={values.minStock ?? "0"} className={inputCls} />
          {err("minStock") && <p className="mt-1 text-xs text-[#dc2626]">{err("minStock")}</p>}
        </div>
      </div>
```

- [ ] **Step 5: Editar — pasar `minStock`**

En `src/app/(app)/operaciones/productos/[id]/editar/page.tsx`, en el objeto `values` del `ProductForm`, añadir:

```typescript
          taxRateId: p.tax_rate_id ?? "", minStock: p.min_stock != null ? String(p.min_stock) : "0" }} />
```

(Reemplaza la línea que hoy cierra el objeto en `taxRateId: p.tax_rate_id ?? "" }} />`.)

- [ ] **Step 6: Verificar tipos + regresión de productos**

Run: `npx tsc --noEmit && npx vitest run tests/productos.test.ts`
Expected: sin errores; productos siguen verdes (min_stock tiene default 0, no rompe los tests existentes).

- [ ] **Step 7: Commit**

```bash
git add src/lib/productos/schema.ts src/lib/productos/mutations.ts "src/app/(app)/operaciones/productos/actions.ts" src/components/productos/product-form.tsx "src/app/(app)/operaciones/productos/[id]/editar/page.tsx"
git commit -m "feat(inventario): campo Stock mínimo en Productos"
```

---

## Task 10: Tests de integración

**Files:**
- Create: `tests/inventario.test.ts`

**Prerequisito:** `npx supabase db reset` aplicado.

- [ ] **Step 1: Escribir los tests**

```typescript
import { describe, it, expect } from "vitest";
import { newUserClient } from "./setup";
import type { SaleSaveInput } from "@/lib/ventas/schema";
import { createDraft, emitSale, voidSale } from "@/lib/ventas/mutations";
import { registerAdjustment } from "@/lib/inventario/mutations";
import { listStock, stockKpi, inventoryStatusBreakdown } from "@/lib/inventario/queries";

async function makeTenant(name: string) {
  const u = await newUserClient();
  const { data: tenantId } = await u.client.rpc("bootstrap_tenant", {
    p_name: name, p_slug: `${name}-${Date.now()}-${Math.random()}`, p_full_name: name,
  });
  return { ...u, tenantId: tenantId as string };
}
async function mainBranch(t: Awaited<ReturnType<typeof makeTenant>>) {
  const { data } = await t.client.from("branches").select("id").eq("tenant_id", t.tenantId).eq("is_main", true).single();
  return data!.id as string;
}
async function makeProduct(t: any, over: Record<string, any> = {}) {
  const { data } = await t.client.from("products")
    .insert({ tenant_id: t.tenantId, kind: "good", name: "Café", price: 10, cost: 4, min_stock: 5, ...over })
    .select("id").single();
  return data!.id as string;
}
async function qtyOf(t: any, productId: string, branchId: string) {
  const { data } = await t.client.from("stock_levels").select("qty").eq("product_id", productId).eq("branch_id", branchId).maybeSingle();
  return data ? Number(data.qty) : 0;
}
const saleOf = (branchId: string, productId: string, quantity: number): SaleSaveInput => ({
  clientId: null, branchId, globalDiscountPct: 0, notes: undefined,
  items: [{ productId, description: "Café", quantity, unitPrice: 10, discountPct: 0, taxRate: 0 }],
});

describe("inventario — ajustes y trigger", () => {
  it("entrada suma, salida resta; permite negativo", async () => {
    const a = await makeTenant("adj"); const b = await mainBranch(a); const p = await makeProduct(a);
    await registerAdjustment(a.client, a.tenantId, a.id, { productId: p, branchId: b, direction: "in", quantity: 10 });
    expect(await qtyOf(a, p, b)).toBe(10);
    await registerAdjustment(a.client, a.tenantId, a.id, { productId: p, branchId: b, direction: "out", quantity: 3 });
    expect(await qtyOf(a, p, b)).toBe(7);
    await registerAdjustment(a.client, a.tenantId, a.id, { productId: p, branchId: b, direction: "out", quantity: 20 });
    expect(await qtyOf(a, p, b)).toBe(-13); // negativo permitido
  });
});

describe("inventario — integración con ventas", () => {
  it("emitir descuenta stock; anular lo repone", async () => {
    const a = await makeTenant("sale"); const b = await mainBranch(a); const p = await makeProduct(a);
    await registerAdjustment(a.client, a.tenantId, a.id, { productId: p, branchId: b, direction: "in", quantity: 10 });
    const id = await createDraft(a.client, a.tenantId, a.id, "USD", saleOf(b, p, 4));
    await emitSale(a.client, id, { paymentType: "contado", paymentMethod: "efectivo" });
    expect(await qtyOf(a, p, b)).toBe(6);
    await voidSale(a.client, id);
    expect(await qtyOf(a, p, b)).toBe(10); // repuesto
  });

  it("un ítem 'service' no genera movimiento", async () => {
    const a = await makeTenant("svc"); const b = await mainBranch(a);
    const svc = await makeProduct(a, { kind: "service", name: "Corte", min_stock: 0 });
    const id = await createDraft(a.client, a.tenantId, a.id, "USD", saleOf(b, svc, 2));
    await emitSale(a.client, id, { paymentType: "credito" });
    expect(await qtyOf(a, svc, b)).toBe(0); // sin stock_levels
  });
});

describe("inventario — queries", () => {
  it("listStock clasifica estados y stockKpi valoriza", async () => {
    const a = await makeTenant("q"); const b = await mainBranch(a);
    const p1 = await makeProduct(a, { name: "Café", cost: 4, min_stock: 5 });
    const p2 = await makeProduct(a, { name: "Té", cost: 2, min_stock: 5 });
    await registerAdjustment(a.client, a.tenantId, a.id, { productId: p1, branchId: b, direction: "in", quantity: 10 }); // en stock
    await registerAdjustment(a.client, a.tenantId, a.id, { productId: p2, branchId: b, direction: "in", quantity: 3 });  // bajo

    const rows = await listStock(a.client, {});
    expect(rows.find((r) => r.productId === p1)?.status).toBe("en_stock");
    expect(rows.find((r) => r.productId === p2)?.status).toBe("bajo");
    expect((await listStock(a.client, { status: "bajo" })).map((r) => r.productId)).toEqual([p2]);

    const kpi = await stockKpi(a.client);
    expect(kpi.value).toBe(46); // 10*4 + 3*2
    expect(kpi.lowCount).toBe(1);
    const bd = await inventoryStatusBreakdown(a.client);
    expect(bd).toMatchObject({ inStock: 1, low: 1, out: 0 });
  });

  it("scoping por sucursal: operativo de otra sucursal no ve el stock", async () => {
    const a = await makeTenant("scope"); const main = await mainBranch(a);
    const { data: otra } = await a.client.from("branches").insert({ tenant_id: a.tenantId, name: "Sur" }).select("id").single();
    const p = await makeProduct(a);
    await registerAdjustment(a.client, a.tenantId, a.id, { productId: p, branchId: main, direction: "in", quantity: 8 });

    const u = await newUserClient();
    await a.client.from("memberships").insert({ user_id: u.id, tenant_id: a.tenantId, role: "vendedor", branch_id: otra!.id });
    const { data } = await u.client.from("stock_levels").select("qty").eq("product_id", p);
    expect(data).toHaveLength(0); // RLS: solo su sucursal (otra), donde no hay stock
  });
});
```

- [ ] **Step 2: Correr los tests — deben pasar**

Run: `npx vitest run tests/inventario.test.ts`
Expected: PASS (todos).

- [ ] **Step 3: Commit**

```bash
git add tests/inventario.test.ts
git commit -m "test(inventario): integración trigger + ventas + queries + scoping sucursal"
```

---

## Task 11: Server Action

**Files:**
- Create: `src/app/(app)/operaciones/inventario/actions.ts`

- [ ] **Step 1: Implementar**

```typescript
"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient as serverSupabase } from "@/lib/supabase/server";
import { adjustmentSchema } from "@/lib/inventario/schema";
import { canManageStock } from "@/lib/inventario/permissions";
import { registerAdjustment } from "@/lib/inventario/mutations";
import type { Role } from "@/lib/auth/roles";
import { redirect } from "next/navigation";

export type FormState = { ok: boolean; error?: string; fieldErrors?: Record<string, string> };

function zodErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of err.issues) { const k = String(i.path[0] ?? "_"); if (!out[k]) out[k] = i.message; }
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

export async function registerAdjustmentAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { sb, userId, role, tenantId } = await ctx();
  if (!canManageStock(role)) return { ok: false, error: "Sin permiso" };
  const parsed = adjustmentSchema.safeParse({
    productId: fd.get("productId"), branchId: fd.get("branchId"),
    direction: fd.get("direction"), quantity: fd.get("quantity"), reason: fd.get("reason"),
  });
  if (!parsed.success) return { ok: false, fieldErrors: zodErrors(parsed.error) };
  try { await registerAdjustment(sb, tenantId, userId, parsed.data); }
  catch (e) { return { ok: false, error: (e as Error).message }; }
  revalidatePath("/operaciones/inventario");
  revalidatePath(`/operaciones/productos/${parsed.data.productId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}
```

- [ ] **Step 2: Verificar tipos + commit**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

```bash
git add "src/app/(app)/operaciones/inventario/actions.ts"
git commit -m "feat(inventario): Server Action registerAdjustment (Zod + canManageStock)"
```

---

## Task 12: Componentes de lista + historial

**Files:**
- Create: `src/components/inventario/stock-status-badge.tsx`, `stock-table.tsx`, `stock-row-card.tsx`, `stock-toolbar.tsx`, `movements-history.tsx`

- [ ] **Step 1: stock-status-badge.tsx**

```tsx
import type { StockStatus } from "@/lib/inventario/queries";

const MAP: Record<StockStatus, { label: string; cls: string }> = {
  en_stock: { label: "En stock", cls: "bg-[#0e7490]/10 text-[#0e7490] dark:text-[#5eead4]" },
  bajo:     { label: "Bajo",     cls: "bg-[#f59e0b]/15 text-[#b45309] dark:text-[#fbbf24]" },
  agotado:  { label: "Agotado",  cls: "bg-[#dc2626]/10 text-[#dc2626]" },
};

export function StockStatusBadge({ status }: { status: StockStatus }) {
  const s = MAP[status] ?? MAP.en_stock;
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span>;
}
```

- [ ] **Step 2: stock-table.tsx**

```tsx
import Link from "next/link";
import type { StockRow } from "@/lib/inventario/queries";
import { StockStatusBadge } from "./stock-status-badge";

export function StockTable({ rows }: { rows: StockRow[] }) {
  return (
    <table className="hidden w-full text-sm lg:table">
      <thead>
        <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--text-soft)]">
          <th className="py-2 font-medium">Producto</th><th className="font-medium">SKU</th>
          <th className="font-medium">Existencia</th><th className="font-medium">Mínimo</th><th className="font-medium">Estado</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.productId} className="border-b border-[var(--border)] hover:bg-[var(--bg)]">
            <td className="py-2.5">
              <Link href={`/operaciones/productos/${r.productId}`} className="font-medium text-[var(--text)] hover:text-[#0e7490]">{r.name}</Link>
            </td>
            <td className="text-[var(--text-soft)]">{r.sku || "—"}</td>
            <td className={r.qty <= 0 ? "text-[#dc2626]" : "text-[var(--text)]"}>{r.qty}</td>
            <td className="text-[var(--text-soft)]">{r.minStock}</td>
            <td><StockStatusBadge status={r.status} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 3: stock-row-card.tsx**

```tsx
import Link from "next/link";
import type { StockRow } from "@/lib/inventario/queries";
import { StockStatusBadge } from "./stock-status-badge";

export function StockRowCard({ r }: { r: StockRow }) {
  return (
    <Link href={`/operaciones/productos/${r.productId}`}
      className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 lg:hidden">
      <div className="min-w-0">
        <p className="truncate font-medium text-[var(--text)]">{r.name}</p>
        <p className="truncate text-xs text-[var(--text-soft)]">{r.sku || "—"} · existencia {r.qty}</p>
      </div>
      <StockStatusBadge status={r.status} />
    </Link>
  );
}
```

- [ ] **Step 4: stock-toolbar.tsx**

```tsx
"use client";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

export function StockToolbar({ branches, showBranch }: { branches: { id: string; name: string }[]; showBranch: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value); else next.delete(key);
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
      <select className={sel} defaultValue={sp.get("status") ?? "todos"} onChange={(e) => setParam("status", e.target.value)}>
        <option value="todos">Todos</option>
        <option value="bajo">Bajo</option>
        <option value="agotado">Agotado</option>
      </select>
      {showBranch && (
        <select className={sel} defaultValue={sp.get("branch") ?? ""} onChange={(e) => setParam("branch", e.target.value)}>
          <option value="">Todas las sucursales</option>
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      )}
    </div>
  );
}
```

- [ ] **Step 5: movements-history.tsx**

```tsx
type Movement = { id: string; type: string; qtyDelta: number; branchName: string | null; reason: string | null; createdAt: string };
const LABEL: Record<string, string> = { adjustment: "Ajuste", sale: "Venta", sale_void: "Anulación venta" };

export function MovementsHistory({ movements }: { movements: Movement[] }) {
  if (movements.length === 0) return <p className="text-sm text-[var(--text-soft)]">Sin movimientos.</p>;
  return (
    <ul className="divide-y divide-[var(--border)]">
      {movements.map((m) => (
        <li key={m.id} className="flex items-center justify-between py-2 text-sm">
          <span className="text-[var(--text)]">
            {LABEL[m.type] ?? m.type}
            <span className="ml-2 text-xs text-[var(--text-soft)]">
              {new Date(m.createdAt).toLocaleDateString("es-VE")}{m.branchName ? ` · ${m.branchName}` : ""}{m.reason ? ` · ${m.reason}` : ""}
            </span>
          </span>
          <span className={`font-semibold ${m.qtyDelta < 0 ? "text-[#dc2626]" : "text-[#0f766e] dark:text-[#6ee7b7]"}`}>
            {m.qtyDelta > 0 ? "+" : ""}{m.qtyDelta}
          </span>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 6: Verificar tipos + commit**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

```bash
git add src/components/inventario/stock-status-badge.tsx src/components/inventario/stock-table.tsx src/components/inventario/stock-row-card.tsx src/components/inventario/stock-toolbar.tsx src/components/inventario/movements-history.tsx
git commit -m "feat(inventario): componentes de lista (badge, table, card, toolbar, historial)"
```

---

## Task 13: Formulario de ajuste + panel de producto

**Files:**
- Create: `src/components/inventario/stock-adjust-form.tsx`, `src/components/inventario/product-stock-panel.tsx`

- [ ] **Step 1: stock-adjust-form.tsx**

```tsx
"use client";
import { useActionState, useEffect, useState } from "react";
import { registerAdjustmentAction, type FormState } from "@/app/(app)/operaciones/inventario/actions";

type LiteProduct = { id: string; name: string };
type Branch = { id: string; name: string };

const initial: FormState = { ok: false };
const inputCls = "w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[#0e7490]";
const labelCls = "mb-1 block text-xs font-medium text-[var(--text-soft)]";

export function StockAdjustForm({ products, productId, branches, userBranchId, isBackOffice }: {
  products?: LiteProduct[]; productId?: string; branches: Branch[]; userBranchId: string | null; isBackOffice: boolean;
}) {
  const [state, formAction, pending] = useActionState(registerAdjustmentAction, initial);
  const [open, setOpen] = useState(false);
  const defaultBranch = userBranchId ?? branches.find((b) => b)?.id ?? "";
  const err = (k: string) => state.fieldErrors?.[k];
  useEffect(() => { if (state.ok) setOpen(false); }, [state]);

  if (!open) return (
    <button type="button" onClick={() => setOpen(true)}
      className="rounded-[10px] bg-gradient-to-br from-[#0e7490] to-[#14b8a6] px-3 py-2 text-sm font-semibold text-white">
      Registrar movimiento
    </button>
  );

  return (
    <form action={formAction} className="max-w-md space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <p className="text-sm font-bold text-[var(--text)]">Registrar movimiento</p>
      {productId
        ? <input type="hidden" name="productId" value={productId} />
        : (
          <div>
            <label className={labelCls}>Producto</label>
            <select name="productId" className={inputCls} defaultValue="">
              <option value="" disabled>Selecciona…</option>
              {(products ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {err("productId") && <p className="mt-1 text-xs text-[#dc2626]">{err("productId")}</p>}
          </div>
        )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Sucursal</label>
          {isBackOffice
            ? <select name="branchId" className={inputCls} defaultValue={defaultBranch}>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
            : <input type="hidden" name="branchId" value={defaultBranch} />}
          {!isBackOffice && <p className="py-2 text-sm text-[var(--text)]">{branches.find((b) => b.id === defaultBranch)?.name ?? "—"}</p>}
        </div>
        <div>
          <label className={labelCls}>Movimiento</label>
          <select name="direction" className={inputCls} defaultValue="in">
            <option value="in">Entrada (+)</option>
            <option value="out">Salida (−)</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Cantidad</label>
          <input name="quantity" type="number" step="0.01" min="0" defaultValue="1" className={inputCls} />
          {err("quantity") && <p className="mt-1 text-xs text-[#dc2626]">{err("quantity")}</p>}
        </div>
        <div><label className={labelCls}>Motivo</label><input name="reason" className={inputCls} placeholder="Carga inicial, merma…" /></div>
      </div>
      {state.error && <p className="text-sm text-[#dc2626]">{state.error}</p>}
      <div className="flex gap-2">
        <button disabled={pending} className="rounded-[10px] bg-gradient-to-br from-[#0e7490] to-[#14b8a6] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
          {pending ? "Guardando…" : "Guardar"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-[10px] border border-[var(--border)] px-4 py-2.5 text-sm text-[var(--text)]">Cancelar</button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: product-stock-panel.tsx**

```tsx
import { getProductStock, listMovements } from "@/lib/inventario/queries";
import { createClient } from "@/lib/supabase/server";
import { canManageStock } from "@/lib/inventario/permissions";
import { MovementsHistory } from "./movements-history";
import { StockAdjustForm } from "./stock-adjust-form";
import type { Role } from "@/lib/auth/roles";

export async function ProductStockPanel({ productId, kind, role, userBranchId }: {
  productId: string; kind: "good" | "service"; role: Role; userBranchId: string | null;
}) {
  if (kind === "service") {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <p className="text-sm font-bold text-[var(--text)]">Existencias</p>
        <p className="mt-2 text-sm text-[var(--text-soft)]">Los servicios no llevan stock.</p>
      </div>
    );
  }
  const sb = await createClient();
  const [stock, movements, { data: branches }] = await Promise.all([
    getProductStock(sb, productId),
    listMovements(sb, productId, { limit: 10 }),
    sb.from("branches").select("id, name").order("is_main", { ascending: false }),
  ]);
  const isBackOffice = ["owner", "admin", "administrativo"].includes(role);

  return (
    <div className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold text-[var(--text)]">Existencias <span className="text-xs font-normal text-[var(--text-soft)]">(mín. {stock.minStock})</span></p>
        {canManageStock(role) && (
          <StockAdjustForm productId={productId} branches={(branches ?? []) as any} userBranchId={userBranchId} isBackOffice={isBackOffice} />
        )}
      </div>
      {stock.levels.length === 0 ? (
        <p className="text-sm text-[var(--text-soft)]">Sin existencias registradas.</p>
      ) : (
        <ul className="space-y-1">
          {stock.levels.map((l) => (
            <li key={l.branchId} className="flex items-center justify-between text-sm">
              <span className="text-[var(--text)]">{l.branchName ?? "—"}</span>
              <span className={`font-semibold ${l.qty <= 0 ? "text-[#dc2626]" : "text-[var(--text)]"}`}>{l.qty}</span>
            </li>
          ))}
        </ul>
      )}
      <div>
        <p className="mb-1 text-xs font-medium text-[var(--text-soft)]">Últimos movimientos</p>
        <MovementsHistory movements={movements} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verificar tipos + commit**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

```bash
git add src/components/inventario/stock-adjust-form.tsx src/components/inventario/product-stock-panel.tsx
git commit -m "feat(inventario): formulario de ajuste + panel de stock del producto"
```

---

## Task 14: Página de Inventario + nav

**Files:**
- Create: `src/app/(app)/operaciones/inventario/page.tsx`
- Modify: `src/lib/nav.ts`

- [ ] **Step 1: Página de Inventario**

```tsx
import { Boxes } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { listStock } from "@/lib/inventario/queries";
import { canManageStock } from "@/lib/inventario/permissions";
import { StockToolbar } from "@/components/inventario/stock-toolbar";
import { StockTable } from "@/components/inventario/stock-table";
import { StockRowCard } from "@/components/inventario/stock-row-card";
import { StockAdjustForm } from "@/components/inventario/stock-adjust-form";
import { EmptyState } from "@/components/shared/empty-state";
import type { Role } from "@/lib/auth/roles";

export default async function InventarioPage({ searchParams }: {
  searchParams: Promise<{ q?: string; status?: string; branch?: string }>;
}) {
  const sp = await searchParams;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  const { data: mem } = await sb.from("memberships").select("role, branch_id").eq("user_id", user!.id).single();
  const role = (mem?.role ?? "vendedor") as Role;
  const isBackOffice = ["owner", "admin", "administrativo"].includes(role);
  const status = (["todos", "bajo", "agotado"].includes(sp.status ?? "") ? sp.status : "todos") as "todos" | "bajo" | "agotado";
  // operativos: siempre su sucursal; back-office: la elegida (o consolidada)
  const branchId = isBackOffice ? (sp.branch || null) : (mem?.branch_id ?? null);

  const [rows, { data: branches }] = await Promise.all([
    listStock(sb, { search: sp.q ?? "", status, branchId }),
    sb.from("branches").select("id, name").order("is_main", { ascending: false }),
  ]);

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-extrabold tracking-[-0.4px] text-[var(--text)]">Inventario</h1>
        {canManageStock(role) && (
          <StockAdjustForm products={rows.map((r) => ({ id: r.productId, name: r.name }))}
            branches={(branches ?? []) as any} userBranchId={mem?.branch_id ?? null} isBackOffice={isBackOffice} />
        )}
      </div>

      <StockToolbar branches={(branches ?? []) as any} showBranch={isBackOffice} />

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
          <EmptyState icon={Boxes} title="Aún no hay productos con stock" hint="Carga existencias con “Registrar movimiento”." />
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-2 lg:p-4">
          <StockTable rows={rows} />
          <div className="space-y-2 lg:hidden">{rows.map((r) => <StockRowCard key={r.productId} r={r} />)}</div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Nav — item Inventario en Operaciones**

En `src/lib/nav.ts`, dentro de `children` de la sección `operaciones`, insertar (después de "Productos"):

```typescript
    { label: "Productos", href: "/operaciones/productos", icon: Package },
    { label: "Inventario", href: "/operaciones/inventario", icon: Boxes },
```

(El icono `Boxes` ya está importado en `nav.ts`.)

- [ ] **Step 3: Verificar tipos + commit**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

```bash
git add "src/app/(app)/operaciones/inventario/page.tsx" src/lib/nav.ts
git commit -m "feat(inventario): página de Inventario en Operaciones + item de nav"
```

---

## Task 15: Detalle de producto (panel) + reporte de valorización

**Files:**
- Modify: `src/app/(app)/operaciones/productos/[id]/page.tsx`
- Modify: `src/app/(app)/reportes/inventario/page.tsx`

- [ ] **Step 1: Detalle de producto — reemplazar el empty state por el panel**

En `src/app/(app)/operaciones/productos/[id]/page.tsx`:

Añadir el import (junto a los existentes):

```typescript
import { ProductStockPanel } from "@/components/inventario/product-stock-panel";
```

Leer `branch_id` del membership: reemplazar la línea que obtiene `mem`:

```typescript
  const { data: mem } = await sb.from("memberships").select("role").eq("user_id", user!.id).single();
```
por:
```typescript
  const { data: mem } = await sb.from("memberships").select("role, branch_id").eq("user_id", user!.id).single();
```

Reemplazar el bloque del empty state:

```tsx
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        <EmptyState icon={Boxes} title="Existencias / Movimientos" hint="Llega con el módulo de Inventario." />
      </div>
```
por:
```tsx
      <ProductStockPanel productId={p.id} kind={p.kind} role={role} userBranchId={mem?.branch_id ?? null} />
```

Si tras el cambio `EmptyState` o `Boxes` quedan sin uso en el archivo, elimínalos del import.

- [ ] **Step 2: Reporte de valorización (`/reportes/inventario`)**

Reemplazar TODO el contenido de `src/app/(app)/reportes/inventario/page.tsx` por:

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTenantCurrency } from "@/lib/productos/queries";
import { inventoryValuation } from "@/lib/inventario/queries";
import { canAccess, type Role } from "@/lib/auth/roles";
import { formatMoney } from "@/lib/format";

export default async function ReporteInventarioPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  const { data: mem } = await sb.from("memberships").select("role").eq("user_id", user!.id).single();
  const role = (mem?.role ?? "vendedor") as Role;
  if (!canAccess(role, "reportes")) redirect("/dashboard");

  const [val, currency] = await Promise.all([inventoryValuation(sb, {}), getTenantCurrency(sb)]);

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-extrabold tracking-[-0.4px] text-[var(--text)]">Valorización de inventario</h1>
        <div className="text-sm text-[var(--text-soft)]">Total: <span className="font-semibold text-[var(--text)]">{formatMoney(val.total, currency)}</span></div>
      </div>

      {val.rows.length === 0 ? (
        <p className="text-sm text-[var(--text-soft)]">Sin existencias para valorizar.</p>
      ) : (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-2 lg:p-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--text-soft)]">
                <th className="py-2 font-medium">Producto</th><th className="font-medium">Sucursal</th>
                <th className="font-medium">Existencia</th><th className="font-medium">Costo</th><th className="font-medium">Valor</th>
              </tr>
            </thead>
            <tbody>
              {val.rows.map((r, i) => (
                <tr key={`${r.productId}-${i}`} className="border-b border-[var(--border)]">
                  <td className="py-2 text-[var(--text)]">{r.name}</td>
                  <td className="text-[var(--text-soft)]">{r.branchName ?? "—"}</td>
                  <td className="text-[var(--text)]">{r.qty}</td>
                  <td className="text-[var(--text-soft)]">{formatMoney(r.cost, currency)}</td>
                  <td className="font-medium text-[var(--text)]">{formatMoney(r.value, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verificar tipos + commit**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

```bash
git add "src/app/(app)/operaciones/productos/[id]/page.tsx" "src/app/(app)/reportes/inventario/page.tsx"
git commit -m "feat(inventario): panel de stock en el producto + reporte de valorización"
```

---

## Task 16: Dashboard

**Files:**
- Modify: `src/app/(app)/dashboard/page.tsx`

- [ ] **Step 1: Imports y datos**

Añadir imports (junto a los existentes):

```typescript
import { stockKpi, inventoryStatusBreakdown } from "@/lib/inventario/queries";
import { canManageProducts } from "@/lib/productos/permissions";
import type { Role } from "@/lib/auth/roles";
```

Obtener el rol: después de la línea que obtiene `profile`, añadir:

```typescript
  const { data: mem } = user ? await supabase.from("memberships").select("role").eq("user_id", user.id).single() : { data: null };
  const role = (mem?.role ?? "vendedor") as Role;
```

Extender el `Promise.all` existente (el que ya trae `salesKpi`/`receivablesTotal`/etc.) añadiendo dos llamadas y calcular los valores. Añadir tras ese `Promise.all`:

```typescript
  const [invKpi, invBreakdown] = await Promise.all([stockKpi(supabase), inventoryStatusBreakdown(supabase)]);
  const valorInventario = canManageProducts(role) && invKpi.value > 0 ? { value: formatMoney(invKpi.value, currency) } : {};
  const bajoStock = (invKpi.lowCount + invKpi.outCount) > 0 ? { value: String(invKpi.lowCount + invKpi.outCount) } : {};
```

(`currency` y `formatMoney` ya están disponibles desde el Plan 5.)

- [ ] **Step 2: KPIs móvil y escritorio**

En el bloque móvil, cambiar:
```tsx
        <KpiCard icon={AlertTriangle} label="Bajo stock" />
```
por:
```tsx
        <KpiCard icon={AlertTriangle} label="Bajo stock" value={bajoStock.value} />
```

En el bloque escritorio, cambiar:
```tsx
        <KpiCard icon={Boxes} label="Valor de inventario" />
```
por:
```tsx
        <KpiCard icon={Boxes} label="Valor de inventario" value={valorInventario.value} />
```
y:
```tsx
        <KpiCard icon={AlertTriangle} label="Bajo stock / agotados" />
```
por:
```tsx
        <KpiCard icon={AlertTriangle} label="Bajo stock / agotados" value={bajoStock.value} />
```

- [ ] **Step 3: "Estado del inventario"**

Reemplazar el `ChartCard` de "Estado del inventario":
```tsx
        <ChartCard title="Estado del inventario" icon={PieChart} empty emptyHint="Aún no hay productos en inventario." />
```
por:
```tsx
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="mb-3 text-sm font-bold text-[var(--text)]">Estado del inventario</p>
          {invBreakdown.inStock + invBreakdown.low + invBreakdown.out === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--text-soft)]">Aún no hay productos en inventario.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              <li className="flex items-center justify-between"><span className="text-[var(--text)]">En stock</span><span className="font-semibold text-[#0f766e] dark:text-[#6ee7b7]">{invBreakdown.inStock}</span></li>
              <li className="flex items-center justify-between"><span className="text-[var(--text)]">Bajo</span><span className="font-semibold text-[#b45309] dark:text-[#fbbf24]">{invBreakdown.low}</span></li>
              <li className="flex items-center justify-between"><span className="text-[var(--text)]">Agotado</span><span className="font-semibold text-[#dc2626]">{invBreakdown.out}</span></li>
            </ul>
          )}
        </div>
```

(Si `PieChart` queda sin uso en el archivo tras el cambio, elimínalo del import de `lucide-react`.)

- [ ] **Step 4: Verificar tipos + commit**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

```bash
git add "src/app/(app)/dashboard/page.tsx"
git commit -m "feat(inventario): dashboard con Valor de inventario, Bajo stock y Estado del inventario"
```

---

## Task 17: Verificación final

**Files:** ninguno (solo verificación).

- [ ] **Step 1: Suite completa**

Run: `npx vitest run`
Expected: PASS todos (previos + inventario; ventas/cobros verdes tras la integración).

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: build exitoso, sin errores.

- [ ] **Step 3: E2E manual (checklist)**

`npm run dev`, como **owner**:
- Crear un producto `good` con Stock mínimo (ej. 5).
- `/operaciones/inventario`: "Registrar movimiento" → Entrada 10 → existencia 10 (En stock). Bajar el mínimo con una salida hasta ≤ 5 → estado Bajo; hasta ≤ 0 → Agotado.
- Detalle del producto: panel de existencias por sucursal + últimos movimientos + Ajustar. Un producto `service` muestra "Los servicios no llevan stock".
- Emitir una venta con ese producto → existencia baja; anular → se repone. Sobreventa → existencia negativa (sin bloqueo).
- Filtros Bajo/Agotado y (back-office) selector de sucursal.
- `/reportes/inventario`: valorización total + por producto.
- Dashboard: "Valor de inventario" (solo con rol que ve costo), "Bajo stock / agotados", "Estado del inventario".

Role-gating (usuarios en `/configuracion/usuarios`):
- **vendedor/cajero:** ven `/operaciones/inventario` (existencias) pero SIN "Registrar movimiento" ni "Ajustar"; en el dashboard "Valor de inventario" les sale vacío; `/reportes/inventario` redirige a `/dashboard`.
- **almacén:** puede ajustar; ve solo su sucursal.

- [ ] **Step 4: Commit final (si hubo ajustes)**

```bash
git add -A
git commit -m "chore(inventario): ajustes finales tras verificación E2E"
```

---

## Notas de cierre

- **DRY:** reusa `round2`, `formatMoney`, `getTenantCurrency`, `EmptyState`, `canManageProducts`, patrón `ctx()`/`FormState`/`zodErrors`. No dupliques.
- **YAGNI:** nada de transferencias, compras/proveedores, lotes ni costeo promedio (ver "Fuera de alcance" del spec).
- **Seguridad:** RLS aísla por tenant y scopea por sucursal; `stock_movements` INSERT es laxo (necesario para el descuento por venta), la barrera de ajustes manuales vive en `registerAdjustmentAction` (`canManageStock`); `stock_levels` es solo lectura (lo escribe el trigger SECURITY DEFINER). Stock negativo permitido a propósito.
- **PWA:** el formulario de ajuste es in-app (no `confirm`/`prompt`).
- **AGENTS.md:** Next.js custom; `params`/`searchParams` son Promises (por eso el `await`).
- **Finish:** con la suite verde + build limpio, usar `superpowers:finishing-a-development-branch` para el merge a `master`.
```
