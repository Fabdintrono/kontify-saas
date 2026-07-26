# Kontify — Presupuestos / Cotizaciones (Plan 8) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Documentos de cotización (borrador→enviado→aceptado/rechazado→convertido) con líneas, descuentos, correlativo propio y vigencia; y "convertir en venta" que crea una venta borrador copiando cliente + líneas.

**Architecture:** Espejo del núcleo de Ventas SIN efecto contable (no stock, no cobros, no correlativo de ventas). Reusa `computeSaleTotals`, `saleLineSchema`, `canSell`, pickers de ventas y `createDraft` de Ventas para la conversión. Correlativo propio (`quote_counters` + RPC `next_quote_number`). RLS con scoping por sucursal como en ventas.

**Tech Stack:** Next.js (custom — ver `AGENTS.md`), RSC + Server Actions + `useActionState`, Supabase (Postgres + RLS + RPC), Zod, Vitest, Tailwind 4.

**Prerequisito de entorno:** Supabase local corriendo (`npx supabase start`). Migraciones/tests con `npx supabase db reset`.

**Referencia viva:** `src/lib/ventas/*`, `src/components/ventas/*` y `src/app/(app)/operaciones/facturacion/*` son la plantilla EXACTA (Presupuestos es su espejo sin pago). Reusar `formatMoney`, `getTenantCurrency`, `EmptyState`, `ClientPicker`/`ProductPicker`, `computeSaleTotals`, `saleLineSchema`, `canSell`, `listActiveClientsLite`/`listActiveProductsLite`/`listBranches`. NO refactorizar ventas.

---

## Estructura de archivos

**Migraciones (crear):** `0023_quotes_schema.sql`, `0024_quotes_rls.sql`, `0025_quote_number_rpc.sql`.

**Capa de datos (crear):** `src/lib/presupuestos/schema.ts`, `mutations.ts`, `queries.ts`. (Permisos: reusa `canSell` de ventas — sin archivo nuevo.)

**Server Actions (crear):** `src/app/(app)/operaciones/presupuestos/actions.ts`.

**UI (crear):** `src/components/presupuestos/{quote-status-badge,quotes-table,quote-row-card,quotes-toolbar,quote-builder,quote-document}.tsx`; `src/app/(app)/operaciones/presupuestos/{page.tsx, nueva/page.tsx, [id]/page.tsx, [id]/editar/page.tsx}`.

**Tests (crear):** `src/lib/presupuestos/schema.test.ts`, `tests/presupuestos.test.ts`.

---

## Task 1: Migración — schema

**Files:**
- Create: `supabase/migrations/0023_quotes_schema.sql`

- [ ] **Step 1: Escribir la migración**

```sql
-- 0023_quotes_schema.sql
create type public.quote_status as enum ('draft','sent','accepted','rejected','converted');

create table public.quote_counters (
  tenant_id   uuid primary key references public.tenants(id) on delete cascade,
  last_number bigint not null default 0
);

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  number bigint,
  branch_id uuid not null references public.branches(id) on delete restrict,
  client_id uuid references public.clients(id) on delete set null,
  status public.quote_status not null default 'draft',
  currency text not null,
  global_discount_pct numeric(5,2) not null default 0,
  subtotal numeric(14,2) not null default 0,
  discount_total numeric(14,2) not null default 0,
  tax_total numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  valid_until date,
  converted_sale_id uuid references public.sales(id) on delete set null,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index quotes_tenant_status on public.quotes (tenant_id, status);
create index quotes_tenant_client on public.quotes (tenant_id, client_id);
create unique index quotes_tenant_number on public.quotes (tenant_id, number) where number is not null;

create table public.quote_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  quote_id uuid not null references public.quotes(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  description text not null,
  quantity numeric(14,2) not null,
  unit_price numeric(14,2) not null,
  discount_pct numeric(5,2) not null default 0,
  tax_rate numeric(5,2) not null default 0,
  position int not null default 0
);
create index quote_items_quote on public.quote_items (quote_id);
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/0023_quotes_schema.sql
git commit -m "feat(presupuestos): migración schema (quotes, quote_items, quote_counters)"
```

---

## Task 2: Migración — RLS + grants

**Files:**
- Create: `supabase/migrations/0024_quotes_rls.sql`

- [ ] **Step 1: Escribir la migración**

```sql
-- 0024_quotes_rls.sql
-- (current_user_branch_id() ya existe desde 0013). Scoping por sucursal como en sales.
alter table public.quotes         enable row level security;
alter table public.quote_items    enable row level security;
alter table public.quote_counters enable row level security;

create policy quotes_select on public.quotes
  for select using (tenant_id = public.current_tenant_id()
    and ( public.current_user_role() in ('owner','admin','administrativo')
          or branch_id = public.current_user_branch_id() ));
create policy quotes_insert on public.quotes
  for insert with check (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin','administrativo','vendedor','cajero')
    and ( public.current_user_role() in ('owner','admin','administrativo')
          or branch_id = public.current_user_branch_id() ));
create policy quotes_update on public.quotes
  for update using (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin','administrativo','vendedor','cajero')
    and ( public.current_user_role() in ('owner','admin','administrativo')
          or branch_id = public.current_user_branch_id() ))
  with check (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin','administrativo','vendedor','cajero')
    and ( public.current_user_role() in ('owner','admin','administrativo')
          or branch_id = public.current_user_branch_id() ));
create policy quotes_delete on public.quotes
  for delete using (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin','administrativo','vendedor','cajero')
    and ( public.current_user_role() in ('owner','admin','administrativo')
          or branch_id = public.current_user_branch_id() ));

-- quote_items: SELECT espeja la visibilidad por sucursal del presupuesto padre.
create policy quote_items_select on public.quote_items
  for select using (tenant_id = public.current_tenant_id()
    and exists ( select 1 from public.quotes q where q.id = quote_id
      and ( public.current_user_role() in ('owner','admin','administrativo')
            or q.branch_id = public.current_user_branch_id() ) ));
create policy quote_items_insert on public.quote_items
  for insert with check (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin','administrativo','vendedor','cajero'));
create policy quote_items_update on public.quote_items
  for update using (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin','administrativo','vendedor','cajero'))
  with check (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin','administrativo','vendedor','cajero'));
create policy quote_items_delete on public.quote_items
  for delete using (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin','administrativo','vendedor','cajero'));

create policy quote_counters_all on public.quote_counters
  for all using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

grant select, insert, update, delete on public.quotes      to authenticated;
grant select, insert, update, delete on public.quote_items to authenticated;
grant select, insert, update on public.quote_counters to authenticated;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/0024_quotes_rls.sql
git commit -m "feat(presupuestos): RLS con scoping por sucursal (espejo de sales)"
```

---

## Task 3: Migración — RPC correlativo

**Files:**
- Create: `supabase/migrations/0025_quote_number_rpc.sql`

- [ ] **Step 1: Escribir la migración**

```sql
-- 0025_quote_number_rpc.sql
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

revoke all on function public.next_quote_number() from public;
grant execute on function public.next_quote_number() to authenticated;
```

- [ ] **Step 2: Aplicar migraciones**

Run: `npx supabase db reset`
Expected: sin error; en el log aparecen `0023`, `0024`, `0025`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0025_quote_number_rpc.sql
git commit -m "feat(presupuestos): RPC next_quote_number (serie propia por empresa)"
```

---

## Task 4: schema.ts (TDD)

**Files:**
- Create: `src/lib/presupuestos/schema.ts`
- Test: `src/lib/presupuestos/schema.test.ts`

- [ ] **Step 1: Escribir el test que falla**

```typescript
import { describe, it, expect } from "vitest";
import { quoteSaveSchema, quoteSendSchema, quoteStatusSchema } from "./schema";

const line = { productId: null, description: "Café", quantity: 1, unitPrice: 10, discountPct: 0, taxRate: 16 };
const base = { clientId: null, branchId: "00000000-0000-0000-0000-000000000001", globalDiscountPct: 0, notes: "", items: [line] };

describe("presupuestos — schema", () => {
  it("guardar permite 0 líneas y valida validUntil opcional", () => {
    expect(quoteSaveSchema.safeParse({ ...base, items: [] }).success).toBe(true);
    const r = quoteSaveSchema.safeParse({ ...base, validUntil: "2026-12-31" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.validUntil).toBe("2026-12-31");
    expect(quoteSaveSchema.safeParse({ ...base, validUntil: "" }).success).toBe(true); // → null
  });
  it("enviar exige ≥1 línea", () => {
    expect(quoteSendSchema.safeParse({ ...base, items: [] }).success).toBe(false);
    expect(quoteSendSchema.safeParse(base).success).toBe(true);
  });
  it("quoteStatusSchema valida accepted/rejected", () => {
    expect(quoteStatusSchema.safeParse({ status: "accepted" }).success).toBe(true);
    expect(quoteStatusSchema.safeParse({ status: "rejected" }).success).toBe(true);
    expect(quoteStatusSchema.safeParse({ status: "draft" }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Correr el test — debe fallar**

Run: `npx vitest run src/lib/presupuestos/schema.test.ts`
Expected: FAIL (no existe `./schema`).

- [ ] **Step 3: Implementar**

```typescript
import { z } from "zod";
import { saleLineSchema } from "@/lib/ventas/schema";

const optStr = (max: number) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().max(max).optional());

const optId =
  z.preprocess((v) => (v === "" || v === "null" || v === undefined ? null : v),
    z.string().guid().nullable().optional());

const optDate =
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida").nullable().optional());

export const quoteSaveSchema = z.object({
  clientId: optId,
  branchId: z.string().guid("Sucursal requerida"),
  globalDiscountPct: z.coerce.number().min(0).max(100).default(0),
  validUntil: optDate,
  notes: optStr(1000),
  items: z.array(saleLineSchema),
});
export type QuoteSaveInput = z.infer<typeof quoteSaveSchema>;

export const quoteSendSchema = quoteSaveSchema.extend({
  items: z.array(saleLineSchema).min(1, "Agrega al menos una línea"),
});

export const quoteStatusSchema = z.object({
  status: z.enum(["accepted", "rejected"], { message: "Estado inválido" }),
});
```

- [ ] **Step 4: Correr el test — debe pasar**

Run: `npx vitest run src/lib/presupuestos/schema.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/presupuestos/schema.ts src/lib/presupuestos/schema.test.ts
git commit -m "feat(presupuestos): esquemas Zod con test (reusa saleLineSchema)"
```

---

## Task 5: mutations.ts

**Files:**
- Create: `src/lib/presupuestos/mutations.ts`

(Se ejercita en los tests de integración de la Task 7.)

- [ ] **Step 1: Implementar**

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";
import type { QuoteSaveInput } from "@/lib/presupuestos/schema";
import type { SaleSaveInput } from "@/lib/ventas/schema";
import { computeSaleTotals } from "@/lib/ventas/totals";
import { createDraft as createSaleDraft } from "@/lib/ventas/mutations";

function headerTotals(input: QuoteSaveInput) {
  const t = computeSaleTotals(
    input.items.map((i) => ({ quantity: i.quantity, unitPrice: i.unitPrice, discountPct: i.discountPct, taxRate: i.taxRate })),
    input.globalDiscountPct,
  );
  return { subtotal: t.subtotal, discount_total: t.discountTotal, tax_total: t.taxTotal, total: t.total };
}

async function replaceItems(sb: SupabaseClient, quoteId: string, tenantId: string, input: QuoteSaveInput) {
  const { error: delErr } = await sb.from("quote_items").delete().eq("quote_id", quoteId);
  if (delErr) throw delErr;
  if (input.items.length === 0) return;
  const rows = input.items.map((i, idx) => ({
    tenant_id: tenantId, quote_id: quoteId, product_id: i.productId ?? null,
    description: i.description, quantity: i.quantity, unit_price: i.unitPrice,
    discount_pct: i.discountPct, tax_rate: i.taxRate, position: idx,
  }));
  const { error } = await sb.from("quote_items").insert(rows);
  if (error) throw error;
}

export async function createDraft(
  sb: SupabaseClient, tenantId: string, userId: string, currency: string, input: QuoteSaveInput,
): Promise<string> {
  const { data, error } = await sb.from("quotes").insert({
    tenant_id: tenantId, created_by: userId, branch_id: input.branchId, client_id: input.clientId ?? null,
    status: "draft", currency, global_discount_pct: input.globalDiscountPct,
    valid_until: input.validUntil ?? null, notes: input.notes ?? null, ...headerTotals(input),
  }).select("id").single();
  if (error) throw error;
  await replaceItems(sb, data.id, tenantId, input);
  return data.id as string;
}

export async function updateDraft(sb: SupabaseClient, id: string, tenantId: string, input: QuoteSaveInput): Promise<void> {
  const { data, error } = await sb.from("quotes").update({
    branch_id: input.branchId, client_id: input.clientId ?? null,
    global_discount_pct: input.globalDiscountPct, valid_until: input.validUntil ?? null,
    notes: input.notes ?? null, ...headerTotals(input), updated_at: new Date().toISOString(),
  }).eq("id", id).eq("status", "draft").select("id");
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("El presupuesto no es un borrador editable");
  await replaceItems(sb, id, tenantId, input);
}

export async function deleteDraft(sb: SupabaseClient, id: string): Promise<void> {
  const { data, error } = await sb.from("quotes").delete().eq("id", id).eq("status", "draft").select("id");
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("Solo se pueden borrar borradores");
}

export async function sendQuote(sb: SupabaseClient, id: string): Promise<void> {
  const { data: q, error: readErr } = await sb.from("quotes").select("id, status").eq("id", id).maybeSingle();
  if (readErr) throw readErr;
  if (!q || q.status !== "draft") throw new Error("Solo se envían borradores");
  const { count } = await sb.from("quote_items").select("id", { count: "exact", head: true }).eq("quote_id", id);
  if (!count) throw new Error("El presupuesto no tiene líneas");
  const { data: num, error: numErr } = await sb.rpc("next_quote_number");
  if (numErr) throw numErr;
  const { data, error } = await sb.from("quotes").update({
    number: num, status: "sent", updated_at: new Date().toISOString(),
  }).eq("id", id).eq("status", "draft").select("id");
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("El presupuesto ya no es un borrador");
}

export async function setQuoteStatus(sb: SupabaseClient, id: string, status: "accepted" | "rejected"): Promise<void> {
  const { data, error } = await sb.from("quotes").update({ status, updated_at: new Date().toISOString() })
    .eq("id", id).in("status", ["sent", "accepted"]).select("id");
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("Solo se marca un presupuesto enviado o aceptado");
}

export async function convertToSale(
  sb: SupabaseClient, tenantId: string, userId: string, currency: string, id: string,
): Promise<string> {
  const { data: q, error: readErr } = await sb.from("quotes")
    .select("id, status, branch_id, client_id, global_discount_pct, notes, converted_sale_id").eq("id", id).maybeSingle();
  if (readErr) throw readErr;
  if (!q || !["sent", "accepted"].includes(q.status)) throw new Error("Solo se convierten presupuestos enviados o aceptados");
  if (q.converted_sale_id) throw new Error("El presupuesto ya fue convertido");

  const { data: items, error: iErr } = await sb.from("quote_items")
    .select("product_id, description, quantity, unit_price, discount_pct, tax_rate").eq("quote_id", id).order("position");
  if (iErr) throw iErr;

  const input: SaleSaveInput = {
    clientId: q.client_id, branchId: q.branch_id, globalDiscountPct: Number(q.global_discount_pct),
    notes: q.notes ?? undefined,
    items: (items ?? []).map((it: any) => ({
      productId: it.product_id ?? null, description: it.description, quantity: Number(it.quantity),
      unitPrice: Number(it.unit_price), discountPct: Number(it.discount_pct), taxRate: Number(it.tax_rate),
    })),
  };
  const saleId = await createSaleDraft(sb, tenantId, userId, currency, input);

  const { data, error } = await sb.from("quotes")
    .update({ status: "converted", converted_sale_id: saleId, updated_at: new Date().toISOString() })
    .eq("id", id).is("converted_sale_id", null).select("id");
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("El presupuesto ya fue convertido");
  return saleId;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/presupuestos/mutations.ts
git commit -m "feat(presupuestos): mutaciones (draft, enviar, aceptar/rechazar, convertir a venta)"
```

---

## Task 6: queries.ts

**Files:**
- Create: `src/lib/presupuestos/queries.ts`

- [ ] **Step 1: Implementar**

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";
import { computeSaleTotals } from "@/lib/ventas/totals";

export type QuoteStatusFilter = "borradores" | "enviados" | "aceptados" | "rechazados" | "convertidos" | "todos";
export type QuoteListRow = {
  id: string; number: number | null; status: string;
  clientName: string | null; branchName: string | null;
  total: number; currency: string; validUntil: string | null; createdAt: string;
};

const STATUS_MAP: Record<string, string> = {
  borradores: "draft", enviados: "sent", aceptados: "accepted", rechazados: "rejected", convertidos: "converted",
};
const NIL_UUID = "00000000-0000-0000-0000-000000000000";
function sanitize(term: string): string { return term.replace(/[%,()*]/g, " ").trim(); }

export async function listQuotes(sb: SupabaseClient, opts: {
  search?: string; status?: QuoteStatusFilter; page?: number; pageSize?: number;
} = {}): Promise<{ rows: QuoteListRow[]; total: number; page: number; pageSize: number }> {
  const { search = "", status = "todos", page = 1, pageSize = 20 } = opts;
  let q = sb.from("quotes").select(
    "id, number, status, total, currency, valid_until, created_at, clients(name), branches(name)",
    { count: "exact" },
  );
  if (STATUS_MAP[status]) q = q.eq("status", STATUS_MAP[status]);
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
  const rows: QuoteListRow[] = (data ?? []).map((r: any) => ({
    id: r.id, number: r.number, status: r.status,
    clientName: r.clients?.name ?? null, branchName: r.branches?.name ?? null,
    total: Number(r.total), currency: r.currency, validUntil: r.valid_until, createdAt: r.created_at,
  }));
  return { rows, total: count ?? 0, page, pageSize };
}

export async function getQuote(sb: SupabaseClient, id: string) {
  const { data, error } = await sb.from("quotes").select("*, clients(name), branches(name)").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { data: items } = await sb.from("quote_items").select("*").eq("quote_id", id).order("position");
  const computed = computeSaleTotals(
    (items ?? []).map((i: any) => ({
      quantity: Number(i.quantity), unitPrice: Number(i.unit_price),
      discountPct: Number(i.discount_pct), taxRate: Number(i.tax_rate),
    })),
    Number(data.global_discount_pct),
  );
  return { ...(data as any), items: items ?? [], computed };
}
```

- [ ] **Step 2: Verificar tipos + commit**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

```bash
git add src/lib/presupuestos/queries.ts
git commit -m "feat(presupuestos): queries (lista + detalle con recompute)"
```

---

## Task 7: Tests de integración

**Files:**
- Create: `tests/presupuestos.test.ts`

**Prerequisito:** `npx supabase db reset` aplicado.

- [ ] **Step 1: Escribir los tests**

```typescript
import { describe, it, expect } from "vitest";
import { newUserClient } from "./setup";
import type { QuoteSaveInput } from "@/lib/presupuestos/schema";
import { createDraft, sendQuote, setQuoteStatus, convertToSale, deleteDraft } from "@/lib/presupuestos/mutations";
import { emitSale } from "@/lib/ventas/mutations";
import { listQuotes } from "@/lib/presupuestos/queries";

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
async function addMember(owner: Awaited<ReturnType<typeof makeTenant>>, role: string, branchId: string | null = null) {
  const u = await newUserClient();
  const { error } = await owner.client.from("memberships").insert({ user_id: u.id, tenant_id: owner.tenantId, role, branch_id: branchId });
  if (error) throw error;
  return u;
}
const quote = (branchId: string, over: Partial<QuoteSaveInput> = {}): QuoteSaveInput => ({
  clientId: null, branchId, globalDiscountPct: 0, validUntil: null, notes: undefined,
  items: [{ productId: null, description: "Prod", quantity: 2, unitPrice: 10, discountPct: 0, taxRate: 16 }], ...over,
});

describe("presupuestos — flujo", () => {
  it("crear → enviar asigna correlativo propio; dos → consecutivos", async () => {
    const a = await makeTenant("flow"); const b = await mainBranch(a);
    const id1 = await createDraft(a.client, a.tenantId, a.id, "USD", quote(b));
    const id2 = await createDraft(a.client, a.tenantId, a.id, "USD", quote(b));
    await sendQuote(a.client, id1);
    await sendQuote(a.client, id2);
    const enviados = await listQuotes(a.client, { status: "enviados" });
    expect(enviados.rows.map((r) => r.number).sort((x, y) => (x! - y!))).toEqual([1, 2]);
  });

  it("aceptar/rechazar desde enviado", async () => {
    const a = await makeTenant("st"); const b = await mainBranch(a);
    const id = await createDraft(a.client, a.tenantId, a.id, "USD", quote(b));
    await sendQuote(a.client, id);
    await setQuoteStatus(a.client, id, "accepted");
    const { data } = await a.client.from("quotes").select("status").eq("id", id).single();
    expect(data!.status).toBe("accepted");
  });

  it("convertir crea una venta borrador con las mismas líneas y no se puede dos veces", async () => {
    const a = await makeTenant("cv"); const b = await mainBranch(a);
    const id = await createDraft(a.client, a.tenantId, a.id, "USD", quote(b));
    await sendQuote(a.client, id);
    const saleId = await convertToSale(a.client, a.tenantId, a.id, "USD", id);

    const { data: sale } = await a.client.from("sales").select("status, total").eq("id", saleId).single();
    expect(sale!.status).toBe("draft");           // venta creada como borrador
    expect(Number(sale!.total)).toBe(23.2);       // 2*10 + 16%
    const { count } = await a.client.from("sale_items").select("id", { count: "exact", head: true }).eq("sale_id", saleId);
    expect(count).toBe(1);

    const { data: q } = await a.client.from("quotes").select("status, converted_sale_id").eq("id", id).single();
    expect(q!.status).toBe("converted");
    expect(q!.converted_sale_id).toBe(saleId);

    await expect(convertToSale(a.client, a.tenantId, a.id, "USD", id)).rejects.toBeTruthy(); // dos veces no
  });

  it("la serie de presupuestos es independiente de la de ventas", async () => {
    const a = await makeTenant("ser"); const b = await mainBranch(a);
    // emitir una venta consume el correlativo de ventas, no el de presupuestos
    const { createDraft: saleDraft } = await import("@/lib/ventas/mutations");
    const sId = await saleDraft(a.client, a.tenantId, a.id, "USD", {
      clientId: null, branchId: b, globalDiscountPct: 0, notes: undefined,
      items: [{ productId: null, description: "X", quantity: 1, unitPrice: 5, discountPct: 0, taxRate: 0 }],
    });
    await emitSale(a.client, sId, { paymentType: "credito" });
    const qId = await createDraft(a.client, a.tenantId, a.id, "USD", quote(b));
    await sendQuote(a.client, qId);
    const { data: q } = await a.client.from("quotes").select("number").eq("id", qId).single();
    expect(Number(q!.number)).toBe(1); // primer presupuesto, aunque ya haya una venta #1
  });

  it("borrar un borrador elimina sus ítems (cascade)", async () => {
    const a = await makeTenant("del"); const b = await mainBranch(a);
    const id = await createDraft(a.client, a.tenantId, a.id, "USD", quote(b));
    await deleteDraft(a.client, id);
    const { count } = await a.client.from("quote_items").select("id", { count: "exact", head: true }).eq("quote_id", id);
    expect(count ?? 0).toBe(0);
  });
});

describe("presupuestos — RLS", () => {
  it("aislamiento entre tenants y almacén no inserta", async () => {
    const a = await makeTenant("aa"); const bb = await makeTenant("bb");
    await createDraft(a.client, a.tenantId, a.id, "USD", quote(await mainBranch(a)));
    expect((await listQuotes(bb.client, { status: "todos" })).total).toBe(0);
    const main = await mainBranch(a);
    const almacen = await addMember(a, "almacen", main);
    const { error } = await almacen.client.from("quotes")
      .insert({ tenant_id: a.tenantId, branch_id: main, status: "draft", currency: "USD" });
    expect(error).not.toBeNull();
  });

  it("scoping por sucursal: vendedor de otra sucursal no ve el presupuesto", async () => {
    const a = await makeTenant("scope"); const main = await mainBranch(a);
    const { data: otra } = await a.client.from("branches").insert({ tenant_id: a.tenantId, name: "Sur" }).select("id").single();
    await createDraft(a.client, a.tenantId, a.id, "USD", quote(main));
    const vOtra = await addMember(a, "vendedor", otra!.id);
    const vMain = await addMember(a, "vendedor", main);
    expect((await listQuotes(vOtra.client, { status: "todos" })).total).toBe(0);
    expect((await listQuotes(vMain.client, { status: "todos" })).total).toBe(1);
  });
});
```

- [ ] **Step 2: Correr los tests — deben pasar**

Run: `npx vitest run tests/presupuestos.test.ts`
Expected: PASS (todos).

- [ ] **Step 3: Commit**

```bash
git add tests/presupuestos.test.ts
git commit -m "test(presupuestos): integración correlativo propio + conversión + RLS scoping"
```

---

## Task 8: Server Actions

**Files:**
- Create: `src/app/(app)/operaciones/presupuestos/actions.ts`

- [ ] **Step 1: Implementar**

```typescript
"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient as serverSupabase } from "@/lib/supabase/server";
import { getTenantCurrency } from "@/lib/productos/queries";
import { quoteSaveSchema, quoteSendSchema, quoteStatusSchema } from "@/lib/presupuestos/schema";
import { canSell } from "@/lib/ventas/permissions";
import * as m from "@/lib/presupuestos/mutations";
import type { Role } from "@/lib/auth/roles";

export type FormState = { ok: boolean; error?: string; fieldErrors?: Record<string, string> };
const LIST = "/operaciones/presupuestos";
const BACK_OFFICE: Role[] = ["owner", "admin", "administrativo"];

function zodErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of err.issues) { const k = String(i.path.join(".") || "_"); if (!out[k]) out[k] = i.message; }
  return out;
}

async function ctx() {
  const sb = await serverSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const { data: mem } = await sb.from("memberships").select("role, branch_id").eq("user_id", user.id).single();
  const { data: tenantId } = await sb.rpc("current_tenant_id");
  return {
    sb, userId: user.id, role: (mem?.role ?? "vendedor") as Role, tenantId: tenantId as string,
    branchId: (mem?.branch_id ?? null) as string | null,
  };
}

function commonFields(fd: FormData) {
  let items: unknown = [];
  try { items = JSON.parse(String(fd.get("items") ?? "[]")); } catch { items = null; }
  return {
    clientId: fd.get("clientId"), branchId: fd.get("branchId"),
    globalDiscountPct: fd.get("globalDiscountPct"), validUntil: fd.get("validUntil"),
    notes: fd.get("notes"), items,
  };
}

export async function submitQuoteAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { sb, userId, role, tenantId, branchId } = await ctx();
  if (!canSell(role)) return { ok: false, error: "Sin permiso" };
  const intent = String(fd.get("intent") ?? "save");
  const id = String(fd.get("id") ?? "");

  const schema = intent === "send" ? quoteSendSchema : quoteSaveSchema;
  const parsed = schema.safeParse(commonFields(fd));
  if (!parsed.success) return { ok: false, fieldErrors: zodErrors(parsed.error) };
  if (!BACK_OFFICE.includes(role) && branchId) parsed.data.branchId = branchId;

  let quoteId = id;
  try {
    const currency = await getTenantCurrency(sb);
    if (id) await m.updateDraft(sb, id, tenantId, parsed.data);
    else quoteId = await m.createDraft(sb, tenantId, userId, currency, parsed.data);
    if (intent === "send") await m.sendQuote(sb, quoteId);
  } catch (e) { return { ok: false, error: (e as Error).message }; }

  revalidatePath(LIST);
  revalidatePath(`${LIST}/${quoteId}`);
  redirect(`${LIST}/${quoteId}`);
}

export async function deleteQuoteAction(fd: FormData): Promise<void> {
  const { sb, role } = await ctx();
  if (!canSell(role)) return;
  const id = String(fd.get("id") ?? "");
  await m.deleteDraft(sb, id);
  revalidatePath(LIST);
  redirect(LIST);
}

export async function setQuoteStatusAction(fd: FormData): Promise<void> {
  const { sb, role } = await ctx();
  if (!canSell(role)) return;
  const id = String(fd.get("id") ?? "");
  const parsed = quoteStatusSchema.safeParse({ status: fd.get("status") });
  if (!parsed.success) return;
  await m.setQuoteStatus(sb, id, parsed.data.status);
  revalidatePath(LIST);
  revalidatePath(`${LIST}/${id}`);
}

export async function convertQuoteAction(fd: FormData): Promise<void> {
  const { sb, userId, role, tenantId } = await ctx();
  if (!canSell(role)) return;
  const id = String(fd.get("id") ?? "");
  const currency = await getTenantCurrency(sb);
  const saleId = await m.convertToSale(sb, tenantId, userId, currency, id);
  revalidatePath(LIST);
  revalidatePath(`${LIST}/${id}`);
  revalidatePath("/operaciones/facturacion");
  redirect(`/operaciones/facturacion/${saleId}/editar`);
}
```

- [ ] **Step 2: Verificar tipos + commit**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

```bash
git add "src/app/(app)/operaciones/presupuestos/actions.ts"
git commit -m "feat(presupuestos): Server Actions (submit save/send, borrar, estado, convertir)"
```

---

## Task 9: Componentes de lista

**Files:**
- Create: `src/components/presupuestos/quote-status-badge.tsx`, `quotes-table.tsx`, `quote-row-card.tsx`, `quotes-toolbar.tsx`

- [ ] **Step 1: quote-status-badge.tsx**

```tsx
const MAP: Record<string, { label: string; cls: string }> = {
  draft:     { label: "Borrador",  cls: "bg-[var(--bg)] text-[var(--text-soft)]" },
  sent:      { label: "Enviado",   cls: "bg-[#0e7490]/10 text-[#0e7490] dark:text-[#5eead4]" },
  accepted:  { label: "Aceptado",  cls: "bg-[#0f766e]/15 text-[#0f766e] dark:text-[#6ee7b7]" },
  rejected:  { label: "Rechazado", cls: "bg-[#dc2626]/10 text-[#dc2626]" },
  converted: { label: "Convertido", cls: "bg-[#7c3aed]/10 text-[#7c3aed] dark:text-[#c4b5fd]" },
};

export function QuoteStatusBadge({ status }: { status: string }) {
  const s = MAP[status] ?? { label: status, cls: "bg-[var(--bg)] text-[var(--text-soft)]" };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span>;
}
```

- [ ] **Step 2: quotes-table.tsx**

```tsx
import Link from "next/link";
import type { QuoteListRow } from "@/lib/presupuestos/queries";
import { formatMoney } from "@/lib/format";
import { QuoteStatusBadge } from "./quote-status-badge";

function isOverdue(r: QuoteListRow): boolean {
  return !!r.validUntil && r.validUntil < new Date().toISOString().slice(0, 10) && ["sent", "accepted"].includes(r.status);
}

export function QuotesTable({ rows }: { rows: QuoteListRow[] }) {
  return (
    <table className="hidden w-full text-sm lg:table">
      <thead>
        <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--text-soft)]">
          <th className="py-2 font-medium">Nº</th><th className="font-medium">Fecha</th><th className="font-medium">Cliente</th>
          <th className="font-medium">Total</th><th className="font-medium">Vigencia</th><th className="font-medium">Estado</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className="border-b border-[var(--border)] hover:bg-[var(--bg)]">
            <td className="py-2.5">
              <Link href={`/operaciones/presupuestos/${r.id}`} className="font-medium text-[var(--text)] hover:text-[#0e7490]">
                {r.number != null ? `#${r.number}` : "—"}
              </Link>
            </td>
            <td className="text-[var(--text-soft)]">{new Date(r.createdAt).toLocaleDateString("es-VE")}</td>
            <td className="text-[var(--text)]">{r.clientName ?? "Consumidor final"}</td>
            <td className="text-[var(--text)]">{formatMoney(r.total, r.currency)}</td>
            <td className={isOverdue(r) ? "text-[#dc2626]" : "text-[var(--text-soft)]"}>
              {r.validUntil ? new Date(r.validUntil).toLocaleDateString("es-VE") : "—"}{isOverdue(r) ? " · vencido" : ""}
            </td>
            <td><QuoteStatusBadge status={r.status} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 3: quote-row-card.tsx**

```tsx
import Link from "next/link";
import type { QuoteListRow } from "@/lib/presupuestos/queries";
import { formatMoney } from "@/lib/format";
import { QuoteStatusBadge } from "./quote-status-badge";

export function QuoteRowCard({ r }: { r: QuoteListRow }) {
  return (
    <Link href={`/operaciones/presupuestos/${r.id}`}
      className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 lg:hidden">
      <div className="min-w-0">
        <p className="truncate font-medium text-[var(--text)]">
          {r.number != null ? `#${r.number}` : "Borrador"} · {r.clientName ?? "Consumidor final"}
        </p>
        <p className="truncate text-xs text-[var(--text-soft)]">{formatMoney(r.total, r.currency)}</p>
      </div>
      <QuoteStatusBadge status={r.status} />
    </Link>
  );
}
```

- [ ] **Step 4: quotes-toolbar.tsx**

```tsx
"use client";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

export function QuotesToolbar() {
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
      <select className={sel} defaultValue={sp.get("status") ?? "todos"} onChange={(e) => setParam("status", e.target.value)}>
        <option value="todos">Todos los estados</option>
        <option value="borradores">Borradores</option>
        <option value="enviados">Enviados</option>
        <option value="aceptados">Aceptados</option>
        <option value="rechazados">Rechazados</option>
        <option value="convertidos">Convertidos</option>
      </select>
    </div>
  );
}
```

- [ ] **Step 5: Verificar tipos + commit**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

```bash
git add src/components/presupuestos/quote-status-badge.tsx src/components/presupuestos/quotes-table.tsx src/components/presupuestos/quote-row-card.tsx src/components/presupuestos/quotes-toolbar.tsx
git commit -m "feat(presupuestos): componentes de lista (badge, table con vencido, card, toolbar)"
```

---

## Task 10: Builder + documento

**Files:**
- Create: `src/components/presupuestos/quote-builder.tsx`, `src/components/presupuestos/quote-document.tsx`

- [ ] **Step 1: quote-builder.tsx** (espeja `sale-builder` sin pago, con "válido hasta" y botón Enviar)

```tsx
"use client";
import { useActionState, useState } from "react";
import { Trash2 } from "lucide-react";
import { submitQuoteAction, type FormState } from "@/app/(app)/operaciones/presupuestos/actions";
import { computeSaleTotals } from "@/lib/ventas/totals";
import { formatMoney } from "@/lib/format";
import { ClientPicker, type LiteClient } from "@/components/ventas/client-picker";
import { ProductPicker, type LiteProduct } from "@/components/ventas/product-picker";

type Line = { productId: string | null; description: string; quantity: number; unitPrice: number; discountPct: number; taxRate: number };
type Branch = { id: string; name: string; is_main: boolean };
type Values = { id?: string; clientId?: string | null; branchId?: string; globalDiscountPct?: number; validUntil?: string; notes?: string; items?: Line[] };

const initial: FormState = { ok: false };
const inputCls = "w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[#0e7490]";
const labelCls = "mb-1 block text-xs font-medium text-[var(--text-soft)]";
const cell = "w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm text-[var(--text)] outline-none focus:border-[#0e7490]";

export function QuoteBuilder({ clients, products, branches, role, userBranchId, currency, values = {} }: {
  clients: LiteClient[]; products: LiteProduct[]; branches: Branch[];
  role: string; userBranchId: string | null; currency: string; values?: Values;
}) {
  const [state, formAction, pending] = useActionState(submitQuoteAction, initial);
  const isBackOffice = ["owner", "admin", "administrativo"].includes(role);
  const defaultBranch = values.branchId ?? userBranchId ?? branches.find((b) => b.is_main)?.id ?? branches[0]?.id ?? "";

  const [clientId, setClientId] = useState<string | null>(values.clientId ?? null);
  const [branchId, setBranchId] = useState<string>(defaultBranch);
  const [globalDiscountPct, setGlobalDiscountPct] = useState<number>(values.globalDiscountPct ?? 0);
  const [validUntil, setValidUntil] = useState<string>(values.validUntil ?? "");
  const [notes, setNotes] = useState<string>(values.notes ?? "");
  const [lines, setLines] = useState<Line[]>(values.items ?? []);

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
      <input type="hidden" name="validUntil" value={validUntil} />
      <input type="hidden" name="notes" value={notes} />
      <input type="hidden" name="items" value={JSON.stringify(lines)} />

      <div className="grid gap-3 sm:grid-cols-3">
        <div><label className={labelCls}>Cliente</label><ClientPicker clients={clients} value={clientId} onChange={setClientId} /></div>
        {isBackOffice && (
          <div><label className={labelCls}>Sucursal</label>
            <select className={inputCls} value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
        )}
        <div><label className={labelCls}>Válido hasta</label>
          <input type="date" className={inputCls} value={validUntil} onChange={(e) => setValidUntil(e.target.value)} /></div>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
        <div className="mb-2"><ProductPicker products={products} onPick={addProduct} /></div>
        {lines.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--text-soft)]">Agrega productos al presupuesto.</p>
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
        <button name="intent" value="send" disabled={pending || lines.length === 0}
          className="rounded-[10px] bg-gradient-to-br from-[#0e7490] to-[#14b8a6] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
          {pending ? "Enviando…" : "Enviar"}
        </button>
      </div>
    </form>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between py-1"><span className="text-[var(--text-soft)]">{label}</span><span className="text-[var(--text)]">{value}</span></div>;
}
```

- [ ] **Step 2: quote-document.tsx** (espeja `sale-document` sin pago, con vigencia)

```tsx
import { formatMoney } from "@/lib/format";
import { QuoteStatusBadge } from "./quote-status-badge";

type Item = { id: string; description: string; quantity: number; unit_price: number; discount_pct: number; tax_rate: number };
type Quote = {
  number: number | null; status: string; currency: string; notes: string | null; valid_until: string | null;
  clients?: { name: string } | null; branches?: { name: string } | null;
  items: Item[]; computed: { subtotal: number; discountTotal: number; taxTotal: number; total: number; lines: { neto: number }[] };
};

export function QuoteDocument({ quote }: { quote: Quote }) {
  const c = quote.currency;
  const overdue = !!quote.valid_until && quote.valid_until < new Date().toISOString().slice(0, 10) && ["sent", "accepted"].includes(quote.status);
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-lg font-extrabold text-[var(--text)]">{quote.number != null ? `Presupuesto #${quote.number}` : "BORRADOR"}</p>
            <p className="text-sm text-[var(--text-soft)]">{quote.clients?.name ?? "Consumidor final"} · {quote.branches?.name ?? "—"}</p>
          </div>
          <div className="flex items-center gap-2">
            {overdue && <span className="rounded-full bg-[#dc2626]/10 px-2 py-0.5 text-xs font-medium text-[#dc2626]">Vencido</span>}
            <QuoteStatusBadge status={quote.status} />
          </div>
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
            {quote.items.map((it, i) => (
              <tr key={it.id} className="border-b border-[var(--border)]">
                <td className="py-1.5 text-[var(--text)]">{it.description}</td>
                <td className="text-[var(--text-soft)]">{Number(it.quantity)}</td>
                <td className="text-[var(--text-soft)]">{formatMoney(Number(it.unit_price), c)}</td>
                <td className="text-[var(--text-soft)]">{Number(it.discount_pct)}%</td>
                <td className="text-[var(--text-soft)]">{Number(it.tax_rate)}%</td>
                <td className="text-right text-[var(--text)]">{formatMoney(quote.computed.lines[i]?.neto ?? 0, c)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-3 ml-auto max-w-xs space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-[var(--text-soft)]">Subtotal</span><span className="text-[var(--text)]">{formatMoney(quote.computed.subtotal, c)}</span></div>
          <div className="flex justify-between"><span className="text-[var(--text-soft)]">Descuentos</span><span className="text-[var(--text)]">{formatMoney(quote.computed.discountTotal, c)}</span></div>
          <div className="flex justify-between"><span className="text-[var(--text-soft)]">Impuesto</span><span className="text-[var(--text)]">{formatMoney(quote.computed.taxTotal, c)}</span></div>
          <div className="flex justify-between border-t border-[var(--border)] pt-1 text-base font-bold text-[var(--text)]"><span>Total</span><span>{formatMoney(quote.computed.total, c)}</span></div>
        </div>
      </div>
      {quote.valid_until && <p className="text-sm text-[var(--text-soft)]">Válido hasta: {new Date(quote.valid_until).toLocaleDateString("es-VE")}</p>}
      {quote.notes && <p className="text-sm text-[var(--text-soft)]">Notas: {quote.notes}</p>}
    </div>
  );
}
```

- [ ] **Step 3: Verificar tipos + commit**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

```bash
git add src/components/presupuestos/quote-builder.tsx src/components/presupuestos/quote-document.tsx
git commit -m "feat(presupuestos): builder (sin pago, con vigencia + Enviar) y documento"
```

---

## Task 11: Páginas (lista, nueva, editar, detalle)

**Files:**
- Create: `src/app/(app)/operaciones/presupuestos/page.tsx`, `nueva/page.tsx`, `[id]/editar/page.tsx`, `[id]/page.tsx`

- [ ] **Step 1: Lista (`page.tsx`)**

```tsx
import Link from "next/link";
import { Plus, ClipboardList } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { listQuotes, type QuoteStatusFilter } from "@/lib/presupuestos/queries";
import { canSell } from "@/lib/ventas/permissions";
import { QuotesToolbar } from "@/components/presupuestos/quotes-toolbar";
import { QuotesTable } from "@/components/presupuestos/quotes-table";
import { QuoteRowCard } from "@/components/presupuestos/quote-row-card";
import { EmptyState } from "@/components/shared/empty-state";
import type { Role } from "@/lib/auth/roles";

export default async function PresupuestosPage({ searchParams }: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  const { data: mem } = await sb.from("memberships").select("role").eq("user_id", user!.id).single();
  const role = (mem?.role ?? "vendedor") as Role;
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const status = (["borradores", "enviados", "aceptados", "rechazados", "convertidos", "todos"].includes(sp.status ?? "") ? sp.status : "todos") as QuoteStatusFilter;

  const list = await listQuotes(sb, { search: sp.q ?? "", status, page });
  const pages = Math.max(1, Math.ceil(list.total / list.pageSize));

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold tracking-[-0.4px] text-[var(--text)]">Presupuestos</h1>
        {canSell(role) && (
          <Link href="/operaciones/presupuestos/nueva"
            className="flex items-center gap-1.5 rounded-[10px] bg-gradient-to-br from-[#0e7490] to-[#14b8a6] px-3 py-2 text-sm font-semibold text-white">
            <Plus className="h-4 w-4" strokeWidth={2.5} /> Nuevo presupuesto
          </Link>
        )}
      </div>

      <QuotesToolbar />

      {list.rows.length === 0 ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
          <EmptyState icon={ClipboardList} title="Aún no hay presupuestos" hint={"Crea el primero con “Nuevo presupuesto”."} />
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-2 lg:p-4">
          <QuotesTable rows={list.rows} />
          <div className="space-y-2 lg:hidden">{list.rows.map((r) => <QuoteRowCard key={r.id} r={r} />)}</div>
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
  params.set("page", String(page));
  return <Link href={`/operaciones/presupuestos?${params.toString()}`} className="rounded px-2 text-[var(--text)] hover:bg-[var(--bg)]">{children}</Link>;
}
```

- [ ] **Step 2: Nueva (`nueva/page.tsx`)**

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTenantCurrency } from "@/lib/productos/queries";
import { listActiveClientsLite, listActiveProductsLite, listBranches } from "@/lib/ventas/queries";
import { canSell } from "@/lib/ventas/permissions";
import { QuoteBuilder } from "@/components/presupuestos/quote-builder";
import type { Role } from "@/lib/auth/roles";

export default async function NuevoPresupuestoPage() {
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
      <h1 className="mb-4 text-xl font-extrabold tracking-[-0.4px] text-[var(--text)]">Nuevo presupuesto</h1>
      <QuoteBuilder clients={clients} products={products} branches={branches}
        role={role} userBranchId={mem?.branch_id ?? null} currency={currency} />
    </div>
  );
}
```

- [ ] **Step 3: Editar (`[id]/editar/page.tsx`)**

```tsx
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTenantCurrency } from "@/lib/productos/queries";
import { listActiveClientsLite, listActiveProductsLite, listBranches } from "@/lib/ventas/queries";
import { getQuote } from "@/lib/presupuestos/queries";
import { canSell } from "@/lib/ventas/permissions";
import { QuoteBuilder } from "@/components/presupuestos/quote-builder";
import type { Role } from "@/lib/auth/roles";

export default async function EditarPresupuestoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  const { data: mem } = await sb.from("memberships").select("role, branch_id").eq("user_id", user!.id).single();
  const role = (mem?.role ?? "vendedor") as Role;
  if (!canSell(role)) redirect("/dashboard");

  const [quote, clients, products, branches, currency] = await Promise.all([
    getQuote(sb, id), listActiveClientsLite(sb), listActiveProductsLite(sb), listBranches(sb), getTenantCurrency(sb),
  ]);
  if (!quote) notFound();
  if (quote.status !== "draft") redirect(`/operaciones/presupuestos/${id}`);

  const items = (quote.items as any[]).map((it) => ({
    productId: it.product_id ?? null, description: it.description, quantity: Number(it.quantity),
    unitPrice: Number(it.unit_price), discountPct: Number(it.discount_pct), taxRate: Number(it.tax_rate),
  }));

  return (
    <div className="p-6">
      <h1 className="mb-4 text-xl font-extrabold tracking-[-0.4px] text-[var(--text)]">Editar presupuesto</h1>
      <QuoteBuilder clients={clients} products={products} branches={branches}
        role={role} userBranchId={mem?.branch_id ?? null} currency={currency}
        values={{ id: quote.id, clientId: quote.client_id, branchId: quote.branch_id,
          globalDiscountPct: Number(quote.global_discount_pct), validUntil: quote.valid_until ?? "",
          notes: quote.notes ?? "", items }} />
    </div>
  );
}
```

- [ ] **Step 4: Detalle (`[id]/page.tsx`)**

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getQuote } from "@/lib/presupuestos/queries";
import { canSell } from "@/lib/ventas/permissions";
import { deleteQuoteAction, setQuoteStatusAction, convertQuoteAction } from "@/app/(app)/operaciones/presupuestos/actions";
import { QuoteDocument } from "@/components/presupuestos/quote-document";
import type { Role } from "@/lib/auth/roles";

export default async function PresupuestoDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createClient();
  const quote = await getQuote(sb, id);
  if (!quote) notFound();
  const { data: { user } } = await sb.auth.getUser();
  const { data: mem } = await sb.from("memberships").select("role").eq("user_id", user!.id).single();
  const role = (mem?.role ?? "vendedor") as Role;
  const allowed = canSell(role);

  const btn = "rounded-[10px] border border-[var(--border)] px-3 py-2 text-sm text-[var(--text)]";
  const primary = "rounded-[10px] bg-gradient-to-br from-[#0e7490] to-[#14b8a6] px-3 py-2 text-sm font-semibold text-white";

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/operaciones/presupuestos" className="text-sm text-[var(--text-soft)] hover:text-[#0e7490]">← Presupuestos</Link>
        <div className="flex flex-wrap items-center gap-2">
          {allowed && quote.status === "draft" && (
            <>
              <Link href={`/operaciones/presupuestos/${quote.id}/editar`} className={`flex items-center gap-1.5 ${btn}`}>
                <Pencil className="h-4 w-4" /> Editar
              </Link>
              <form action={deleteQuoteAction}>
                <input type="hidden" name="id" value={quote.id} />
                <button className={`${btn} text-[#dc2626]`}>Eliminar</button>
              </form>
            </>
          )}
          {allowed && (quote.status === "sent" || quote.status === "accepted") && (
            <>
              {quote.status === "sent" && (
                <form action={setQuoteStatusAction}>
                  <input type="hidden" name="id" value={quote.id} />
                  <input type="hidden" name="status" value="accepted" />
                  <button className={btn}>Marcar aceptado</button>
                </form>
              )}
              <form action={setQuoteStatusAction}>
                <input type="hidden" name="id" value={quote.id} />
                <input type="hidden" name="status" value="rejected" />
                <button className={`${btn} text-[#dc2626]`}>Marcar rechazado</button>
              </form>
              <form action={convertQuoteAction}>
                <input type="hidden" name="id" value={quote.id} />
                <button className={primary}>Convertir en venta</button>
              </form>
            </>
          )}
          {quote.status === "converted" && quote.converted_sale_id && (
            <Link href={`/operaciones/facturacion/${quote.converted_sale_id}`} className={primary}>Ver venta</Link>
          )}
        </div>
      </div>

      <QuoteDocument quote={quote as any} />
    </div>
  );
}
```

- [ ] **Step 5: Verificar tipos + commit**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

```bash
git add "src/app/(app)/operaciones/presupuestos/page.tsx" "src/app/(app)/operaciones/presupuestos/nueva/page.tsx" "src/app/(app)/operaciones/presupuestos/[id]/editar/page.tsx" "src/app/(app)/operaciones/presupuestos/[id]/page.tsx"
git commit -m "feat(presupuestos): páginas lista/nueva/editar/detalle con acciones por estado"
```

---

## Task 12: Verificación final

**Files:** ninguno (solo verificación).

- [ ] **Step 1: Suite completa**

Run: `npx vitest run`
Expected: PASS todos (previos + presupuestos; ventas/cobros/inventario verdes).

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: build exitoso, sin errores.

- [ ] **Step 3: E2E manual (checklist)**

`npm run dev`, como **owner**:
- `/operaciones/presupuestos`: empty state; "Nuevo presupuesto".
- Crear: cliente + líneas + descuentos + "válido hasta"; totales en vivo. "Guardar borrador" → detalle BORRADOR; Editar; volver.
- "Enviar" (desde el editor) → número asignado (#1), estado Enviado.
- Detalle enviado: "Marcar aceptado" / "Marcar rechazado" / **"Convertir en venta"**.
- Convertir → cae en `/operaciones/facturacion/[id]/editar` con las líneas copiadas → emitir la venta ahí. El presupuesto queda "Convertido" con "Ver venta".
- Intentar convertir de nuevo (no debería: ya está convertido, sin botón).
- Vencido: crear con "válido hasta" en el pasado, enviar → marca "Vencido".
- Lista: buscar por número/cliente, filtro por estado.

Role-gating (usuarios en `/configuracion/usuarios`):
- **almacén:** sin "Nuevo presupuesto"; `/operaciones/presupuestos/nueva` redirige a `/dashboard`; RLS niega insertar.
- **vendedor** de una sucursal: solo ve los presupuestos de su sucursal.

- [ ] **Step 4: Commit final (si hubo ajustes)**

```bash
git add -A
git commit -m "chore(presupuestos): ajustes finales tras verificación E2E"
```

---

## Notas de cierre

- **DRY:** reusa `computeSaleTotals`, `saleLineSchema`, `canSell`, `formatMoney`, `getTenantCurrency`, `EmptyState`, `ClientPicker`/`ProductPicker`, `listActiveClientsLite`/`listActiveProductsLite`/`listBranches`, `createDraft` de Ventas. No dupliques.
- **YAGNI:** nada de PDF, plantillas, conversión parcial, versiones ni multi-moneda (ver "Fuera de alcance" del spec).
- **Seguridad:** RLS aísla por tenant + scopea por sucursal (quotes y quote_items) como en ventas; el `submitQuoteAction` fuerza `branchId` del operativo. La conversión es única (guard `converted_sale_id`). La venta creada al convertir nace `draft` — no numera, no descuenta stock, no cobra hasta que se emita.
- **AGENTS.md:** Next.js custom; `params`/`searchParams` son Promises (por eso el `await`).
- **Finish:** con la suite verde + build limpio, usar `superpowers:finishing-a-development-branch` para el merge a `master`.
```
