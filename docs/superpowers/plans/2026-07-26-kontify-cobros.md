# Kontify — Cobros / Cuentas por Cobrar (Plan 6) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Registrar cobros (abonos totales/parciales) contra ventas emitidas, anularlos, y una pantalla Cuentas por Cobrar por cliente con aging; `sales.paid_amount` pasa a derivarse por trigger y el contado crea un cobro al emitir.

**Architecture:** Tabla `payments` como fuente de verdad; trigger recalcula `sales.paid_amount`; columna generada `sales.balance` para filtrar saldo. Capa testeable `src/lib/cobros/*` + Server Actions. RLS laxo en `payments` (para que el contado lo cree cualquier rol de venta) + barrera de abonos manuales en la acción (`canRegisterPayment` = back-office). Espeja el patrón de los módulos previos.

**Tech Stack:** Next.js (custom — ver `AGENTS.md`), RSC + Server Actions + `useActionState`, Supabase (Postgres + RLS + trigger), Zod, Vitest, Tailwind 4.

**Prerequisito de entorno:** Supabase local corriendo (`npx supabase start`). Migraciones y tests con `npx supabase db reset`.

**Referencia viva:** `src/lib/ventas/*`, `src/lib/productos/*`, sus actions/UI y `src/lib/format.ts` son la plantilla. NO refactorizar. Reusar `formatMoney`, `getTenantCurrency`, `EmptyState`, patrón `ctx()`/`FormState`/`zodErrors`.

---

## Estructura de archivos

**Migraciones (crear):**
- `supabase/migrations/0016_payments_schema.sql` — `payments` + `sales.due_date` + `sales.balance` generado + índices.
- `supabase/migrations/0017_payments_rls.sql` — policies + grants.
- `supabase/migrations/0018_paid_amount_trigger.sql` — función + trigger.

**Capa de datos (crear):**
- `src/lib/cobros/permissions.ts`, `schema.ts`, `mutations.ts`, `queries.ts`.

**Modificar (Facturación):**
- `src/lib/ventas/schema.ts` — `emitSchema` gana `dueDate`.
- `src/lib/ventas/mutations.ts` — `emitSale` (contado crea payment + due_date), `voidSale` (bloqueo por cobros activos).
- `src/lib/ventas/queries.ts` — `listSales` filtro "pendientes" → `balance>0`.
- `src/app/(app)/operaciones/facturacion/actions.ts` — `emitSaleAction` pasa `dueDate`.
- `src/components/ventas/sale-builder.tsx` — campo vencimiento en el panel de emisión (crédito).
- `src/app/(app)/operaciones/facturacion/[id]/page.tsx` — sección Cobros + gating del botón Anular.

**Server Actions (crear):**
- `src/app/(app)/finanzas/cuentas-por-cobrar/actions.ts`.

**UI (crear):**
- `src/components/cobros/receivables-table.tsx`, `receivable-row-card.tsx`, `receivables-toolbar.tsx`, `payment-form.tsx`, `payments-history.tsx`, `due-date-field.tsx`.
- `src/app/(app)/finanzas/cuentas-por-cobrar/page.tsx` (reemplaza placeholder), `.../[clientId]/page.tsx`.

**Tests (crear):**
- `src/lib/cobros/permissions.test.ts`, `schema.test.ts`, `tests/cobros.test.ts`.

---

## Task 1: Migración — payments + columnas de sales

**Files:**
- Create: `supabase/migrations/0016_payments_schema.sql`

- [ ] **Step 1: Escribir la migración**

```sql
-- 0016_payments_schema.sql
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  sale_id uuid not null references public.sales(id) on delete cascade,
  amount numeric(14,2) not null,
  method text,
  reference text,
  paid_at date not null default current_date,
  voided boolean not null default false,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index payments_tenant on public.payments (tenant_id);
create index payments_sale on public.payments (sale_id);

alter table public.sales add column due_date date;
alter table public.sales add column balance numeric(14,2)
  generated always as (total - paid_amount) stored;
create index sales_tenant_balance on public.sales (tenant_id, balance);
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/0016_payments_schema.sql
git commit -m "feat(cobros): migración schema (payments + sales.due_date + sales.balance)"
```

---

## Task 2: Migración — RLS + grants

**Files:**
- Create: `supabase/migrations/0017_payments_rls.sql`

- [ ] **Step 1: Escribir la migración**

```sql
-- 0017_payments_rls.sql
alter table public.payments enable row level security;

-- Laxo: los 5 roles de venta pueden leer/insertar (para que el contado, emitido por
-- vendedor/cajero, cree su cobro). La barrera de abonos manuales vive en la Server Action.
create policy payments_select on public.payments
  for select using (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin','administrativo','vendedor','cajero'));
create policy payments_insert on public.payments
  for insert with check (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin','administrativo','vendedor','cajero'));
-- Anular (voided) solo owner/admin.
create policy payments_update on public.payments
  for update using (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin'))
  with check (tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('owner','admin'));

grant select, insert, update on public.payments to authenticated;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/0017_payments_rls.sql
git commit -m "feat(cobros): RLS laxo en payments (contado) + anular solo owner/admin"
```

---

## Task 3: Migración — trigger de paid_amount

**Files:**
- Create: `supabase/migrations/0018_paid_amount_trigger.sql`

- [ ] **Step 1: Escribir la migración**

```sql
-- 0018_paid_amount_trigger.sql
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

- [ ] **Step 2: Aplicar todas las migraciones al Supabase local**

Run: `npx supabase db reset`
Expected: sin error; en el log aparecen `0016`, `0017`, `0018`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0018_paid_amount_trigger.sql
git commit -m "feat(cobros): trigger recompute_sale_paid_amount (paid_amount derivado)"
```

---

## Task 4: permissions.ts (TDD)

**Files:**
- Create: `src/lib/cobros/permissions.ts`
- Test: `src/lib/cobros/permissions.test.ts`

- [ ] **Step 1: Escribir el test que falla**

```typescript
import { describe, it, expect } from "vitest";
import { canRegisterPayment, canVoidPayment, canEditDueDate } from "./permissions";

describe("cobros — permissions", () => {
  it("canRegisterPayment: back-office sí; vendedor/cajero/almacen no", () => {
    expect(["owner", "admin", "administrativo"].every(canRegisterPayment as any)).toBe(true);
    expect(canRegisterPayment("vendedor")).toBe(false);
    expect(canRegisterPayment("cajero")).toBe(false);
    expect(canRegisterPayment("almacen")).toBe(false);
  });
  it("canVoidPayment solo owner/admin", () => {
    expect(canVoidPayment("owner")).toBe(true);
    expect(canVoidPayment("admin")).toBe(true);
    expect(canVoidPayment("administrativo")).toBe(false);
  });
  it("canEditDueDate: back-office", () => {
    expect(canEditDueDate("administrativo")).toBe(true);
    expect(canEditDueDate("vendedor")).toBe(false);
  });
});
```

- [ ] **Step 2: Correr el test — debe fallar**

Run: `npx vitest run src/lib/cobros/permissions.test.ts`
Expected: FAIL (no existe `./permissions`).

- [ ] **Step 3: Implementar**

```typescript
import type { Role } from "@/lib/auth/roles";

const BACK_OFFICE: Role[] = ["owner", "admin", "administrativo"];

export const canRegisterPayment = (role: Role): boolean => BACK_OFFICE.includes(role);
export const canEditDueDate = (role: Role): boolean => BACK_OFFICE.includes(role);
export const canVoidPayment = (role: Role): boolean => role === "owner" || role === "admin";
```

- [ ] **Step 4: Correr el test — debe pasar**

Run: `npx vitest run src/lib/cobros/permissions.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/cobros/permissions.ts src/lib/cobros/permissions.test.ts
git commit -m "feat(cobros): helpers de permisos con test"
```

---

## Task 5: schema.ts (TDD)

**Files:**
- Create: `src/lib/cobros/schema.ts`
- Test: `src/lib/cobros/schema.test.ts`

- [ ] **Step 1: Escribir el test que falla**

```typescript
import { describe, it, expect } from "vitest";
import { paymentCreateSchema, dueDateSchema } from "./schema";

const sid = "11111111-1111-1111-1111-111111111111";

describe("cobros — schema", () => {
  it("acepta un abono válido y castea amount", () => {
    const r = paymentCreateSchema.safeParse({ saleId: sid, amount: "50.5", method: "efectivo" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.amount).toBe(50.5);
  });
  it("rechaza amount <= 0 y saleId faltante", () => {
    expect(paymentCreateSchema.safeParse({ saleId: sid, amount: 0 }).success).toBe(false);
    expect(paymentCreateSchema.safeParse({ saleId: sid, amount: -1 }).success).toBe(false);
    expect(paymentCreateSchema.safeParse({ amount: 10 }).success).toBe(false);
  });
  it("rechaza paidAt futura", () => {
    expect(paymentCreateSchema.safeParse({ saleId: sid, amount: 10, paidAt: "2999-01-01" }).success).toBe(false);
  });
  it("dueDate acepta fecha o null", () => {
    expect(dueDateSchema.safeParse({ saleId: sid, dueDate: "2026-12-31" }).success).toBe(true);
    expect(dueDateSchema.safeParse({ saleId: sid, dueDate: "" }).success).toBe(true); // → null
  });
});
```

- [ ] **Step 2: Correr el test — debe fallar**

Run: `npx vitest run src/lib/cobros/schema.test.ts`
Expected: FAIL (no existe `./schema`).

- [ ] **Step 3: Implementar**

```typescript
import { z } from "zod";

const optStr = (max: number) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().max(max).optional());

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const todayISO = () => new Date().toISOString().slice(0, 10);

const optDate =
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().regex(DATE_RE, "Fecha inválida").optional());

export const paymentCreateSchema = z.object({
  saleId: z.string().guid("Venta requerida"),
  amount: z.coerce.number().positive("El monto debe ser mayor a 0"),
  method: optStr(40),
  reference: optStr(60),
  paidAt: optDate.refine((v) => !v || v <= todayISO(), "La fecha no puede ser futura"),
  notes: optStr(500),
});
export type PaymentInput = z.infer<typeof paymentCreateSchema>;

export const dueDateSchema = z.object({
  saleId: z.string().guid(),
  dueDate: z.preprocess((v) => (v === "" || v === "null" || v === undefined ? null : v),
    z.string().regex(DATE_RE, "Fecha inválida").nullable()),
});
```

- [ ] **Step 4: Correr el test — debe pasar**

Run: `npx vitest run src/lib/cobros/schema.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/cobros/schema.ts src/lib/cobros/schema.test.ts
git commit -m "feat(cobros): esquemas Zod con test (abono + vencimiento)"
```

---

## Task 6: mutations.ts

**Files:**
- Create: `src/lib/cobros/mutations.ts`

(Se ejercita en los tests de integración de la Task 9.)

- [ ] **Step 1: Implementar**

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PaymentInput } from "@/lib/cobros/schema";

export async function registerPayment(
  sb: SupabaseClient, tenantId: string, userId: string, input: PaymentInput,
): Promise<string> {
  const { data: sale, error: readErr } = await sb.from("sales")
    .select("id, status, balance").eq("id", input.saleId).maybeSingle();
  if (readErr) throw readErr;
  if (!sale || sale.status !== "issued") throw new Error("Solo se cobran ventas emitidas");
  const balance = Number(sale.balance);
  if (input.amount > balance + 1e-9) throw new Error("El abono supera el saldo pendiente");

  const { data, error } = await sb.from("payments").insert({
    tenant_id: tenantId, sale_id: input.saleId, amount: input.amount,
    method: input.method ?? null, reference: input.reference ?? null,
    paid_at: input.paidAt ?? new Date().toISOString().slice(0, 10),
    notes: input.notes ?? null, created_by: userId,
  }).select("id").single();
  if (error) throw error;
  return data.id as string;
}

export async function voidPayment(sb: SupabaseClient, id: string): Promise<void> {
  const { data, error } = await sb.from("payments")
    .update({ voided: true }).eq("id", id).eq("voided", false).select("id");
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("El cobro ya estaba anulado o no existe");
}

export async function setDueDate(sb: SupabaseClient, saleId: string, dueDate: string | null): Promise<void> {
  const { data, error } = await sb.from("sales")
    .update({ due_date: dueDate, updated_at: new Date().toISOString() })
    .eq("id", saleId).eq("status", "issued").select("id");
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("Solo se fija vencimiento en ventas emitidas");
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/cobros/mutations.ts
git commit -m "feat(cobros): mutaciones (registrar/anular abono, fijar vencimiento)"
```

---

## Task 7: queries.ts

**Files:**
- Create: `src/lib/cobros/queries.ts`

- [ ] **Step 1: Implementar**

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";
import { round2 } from "@/lib/ventas/totals";

const NIL_UUID = "00000000-0000-0000-0000-000000000000";
function sanitize(term: string): string { return term.replace(/[%,()*]/g, " ").trim(); }
function todayISO(): string { return new Date().toISOString().slice(0, 10); }

export type ReceivableClientRow = { clientId: string | null; name: string; totalDue: number; overdueAmount: number; oldestDueDate: string | null };

export async function listReceivablesByClient(sb: SupabaseClient, opts: {
  search?: string; filter?: "todos" | "vencidos";
} = {}): Promise<ReceivableClientRow[]> {
  try {
    const { search = "", filter = "todos" } = opts;
    let q = sb.from("sales").select("client_id, total, paid_amount, balance, due_date, clients(name)")
      .eq("status", "issued").gt("balance", 0);
    const s = sanitize(search);
    if (s) {
      const { data: cids } = await sb.from("clients").select("id").ilike("name", `%${s}%`);
      const ids = (cids ?? []).map((c: any) => c.id);
      q = q.in("client_id", ids.length ? ids : [NIL_UUID]);
    }
    const { data, error } = await q;
    if (error || !data) return [];
    const today = todayISO();
    const map = new Map<string, ReceivableClientRow>();
    for (const r of data as any[]) {
      const key = r.client_id ?? "none";
      const cur = map.get(key) ?? { clientId: r.client_id ?? null, name: r.clients?.name ?? "Consumidor final", totalDue: 0, overdueAmount: 0, oldestDueDate: null };
      const bal = Number(r.balance);
      cur.totalDue += bal;
      const overdue = r.due_date && r.due_date < today;
      if (overdue) {
        cur.overdueAmount += bal;
        if (!cur.oldestDueDate || r.due_date < cur.oldestDueDate) cur.oldestDueDate = r.due_date;
      }
      map.set(key, cur);
    }
    let rows = [...map.values()].map((r) => ({ ...r, totalDue: round2(r.totalDue), overdueAmount: round2(r.overdueAmount) }));
    if (filter === "vencidos") rows = rows.filter((r) => r.overdueAmount > 0);
    return rows.sort((a, b) => b.totalDue - a.totalDue);
  } catch { return []; }
}

export async function getClientReceivable(sb: SupabaseClient, clientId: string): Promise<{
  clientName: string | null;
  rows: { saleId: string; number: number | null; total: number; paid: number; balance: number; dueDate: string | null; overdue: boolean }[];
  totalDue: number; overdueAmount: number;
}> {
  try {
    const { data, error } = await sb.from("sales")
      .select("id, number, total, paid_amount, balance, due_date, clients(name)")
      .eq("client_id", clientId).eq("status", "issued").gt("balance", 0).order("due_date", { nullsFirst: false });
    if (error || !data) return { clientName: null, rows: [], totalDue: 0, overdueAmount: 0 };
    const today = todayISO();
    let totalDue = 0, overdueAmount = 0;
    const rows = (data as any[]).map((r) => {
      const balance = Number(r.balance);
      const overdue = !!(r.due_date && r.due_date < today);
      totalDue += balance;
      if (overdue) overdueAmount += balance;
      return { saleId: r.id, number: r.number, total: Number(r.total), paid: Number(r.paid_amount), balance, dueDate: r.due_date, overdue };
    });
    return { clientName: (data[0] as any)?.clients?.name ?? null, rows, totalDue: round2(totalDue), overdueAmount: round2(overdueAmount) };
  } catch { return { clientName: null, rows: [], totalDue: 0, overdueAmount: 0 }; }
}

export async function listPayments(sb: SupabaseClient, saleId: string): Promise<{
  id: string; amount: number; method: string | null; reference: string | null; paidAt: string; voided: boolean;
}[]> {
  const { data, error } = await sb.from("payments").select("id, amount, method, reference, paid_at, voided")
    .eq("sale_id", saleId).order("paid_at").order("created_at");
  if (error || !data) return [];
  return data.map((p: any) => ({ id: p.id, amount: Number(p.amount), method: p.method, reference: p.reference, paidAt: p.paid_at, voided: p.voided }));
}

export async function receivablesKpi(sb: SupabaseClient): Promise<{ total: number; overdue: number }> {
  try {
    const { data, error } = await sb.from("sales").select("balance, due_date").eq("status", "issued").gt("balance", 0);
    if (error || !data) return { total: 0, overdue: 0 };
    const today = todayISO();
    let total = 0, overdue = 0;
    for (const r of data as any[]) { const b = Number(r.balance); total += b; if (r.due_date && r.due_date < today) overdue += b; }
    return { total: round2(total), overdue: round2(overdue) };
  } catch { return { total: 0, overdue: 0 }; }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/cobros/queries.ts
git commit -m "feat(cobros): queries (CxC por cliente, estado de cuenta, historial, kpi)"
```

---

## Task 8: Cambios en Facturación (emit/void/listSales + schema)

**Files:**
- Modify: `src/lib/ventas/schema.ts`
- Modify: `src/lib/ventas/mutations.ts` (`emitSale`, `voidSale`)
- Modify: `src/lib/ventas/queries.ts` (`listSales` filtro pendientes)
- Modify: `src/app/(app)/operaciones/facturacion/actions.ts` (`emitSaleAction` pasa `dueDate`)

- [ ] **Step 1: `emitSchema` gana `dueDate`**

En `src/lib/ventas/schema.ts`, reemplazar el bloque `emitSchema`:

```typescript
export const emitSchema = z.object({
  paymentType: z.enum(["contado", "credito"], { message: "Tipo de pago inválido" }),
  paymentMethod: optStr(40),
});
```

por:

```typescript
export const emitSchema = z.object({
  paymentType: z.enum(["contado", "credito"], { message: "Tipo de pago inválido" }),
  paymentMethod: optStr(40),
  dueDate: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida").optional()),
});
```

- [ ] **Step 2: `emitSale` — contado crea payment + due_date (crédito)**

En `src/lib/ventas/mutations.ts`, reemplazar toda la función `emitSale` por:

```typescript
export async function emitSale(sb: SupabaseClient, id: string, payment: EmitInput): Promise<void> {
  const { data: sale, error: readErr } = await sb.from("sales")
    .select("id, status, total, tenant_id, created_by").eq("id", id).maybeSingle();
  if (readErr) throw readErr;
  if (!sale || sale.status !== "draft") throw new Error("Solo se emiten borradores");
  const { count } = await sb.from("sale_items").select("id", { count: "exact", head: true }).eq("sale_id", id);
  if (!count) throw new Error("La venta no tiene líneas");
  const { data: num, error: numErr } = await sb.rpc("next_sale_number");
  if (numErr) throw numErr;

  const { data, error } = await sb.from("sales").update({
    number: num, status: "issued", issued_at: new Date().toISOString(),
    payment_method: payment.paymentType === "contado" ? (payment.paymentMethod ?? null) : null,
    due_date: payment.paymentType === "credito" ? (payment.dueDate ?? null) : null,
    updated_at: new Date().toISOString(),
  }).eq("id", id).eq("status", "draft").select("id");
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("La venta ya no es un borrador");

  // El contado se registra como un cobro por el total → el trigger fija paid_amount.
  if (payment.paymentType === "contado") {
    const { error: payErr } = await sb.from("payments").insert({
      tenant_id: sale.tenant_id, sale_id: id, amount: Number(sale.total),
      method: payment.paymentMethod ?? null, paid_at: new Date().toISOString().slice(0, 10),
      created_by: sale.created_by,
    });
    if (payErr) throw payErr;
  }
}
```

- [ ] **Step 3: `voidSale` — bloquear si hay cobros activos**

En `src/lib/ventas/mutations.ts`, reemplazar `voidSale` por:

```typescript
export async function voidSale(sb: SupabaseClient, id: string): Promise<void> {
  const { count } = await sb.from("payments").select("id", { count: "exact", head: true })
    .eq("sale_id", id).eq("voided", false);
  if (count && count > 0) throw new Error("Anula primero los cobros de esta venta");
  const { data, error } = await sb.from("sales").update({ status: "void", updated_at: new Date().toISOString() })
    .eq("id", id).eq("status", "issued").select("id");
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("Solo se anulan ventas emitidas");
}
```

- [ ] **Step 4: `listSales` — filtro "pendientes" por saldo**

En `src/lib/ventas/queries.ts`, reemplazar la línea:

```typescript
  if (payment === "pendientes") q = q.eq("status", "issued").eq("paid_amount", 0);
```

por:

```typescript
  if (payment === "pendientes") q = q.eq("status", "issued").gt("balance", 0);
```

(Y quitar el comentario `// núcleo: sin abonos parciales …` de la línea anterior.)

- [ ] **Step 5: `emitSaleAction` pasa `dueDate`**

En `src/app/(app)/operaciones/facturacion/actions.ts`, reemplazar:

```typescript
      const pay = emitSchema.safeParse({ paymentType: fd.get("paymentType"), paymentMethod: fd.get("paymentMethod") });
```

por:

```typescript
      const pay = emitSchema.safeParse({ paymentType: fd.get("paymentType"), paymentMethod: fd.get("paymentMethod"), dueDate: fd.get("dueDate") });
```

- [ ] **Step 6: Aplicar migraciones y correr regresión de ventas**

Run: `npx supabase db reset && npx vitest run tests/ventas.test.ts src/lib/ventas/`
Expected: PASS (las ventas siguen verdes: contado ahora crea payment pero el saldo sigue 0; crédito sin payment).

- [ ] **Step 7: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

- [ ] **Step 8: Commit**

```bash
git add src/lib/ventas/schema.ts src/lib/ventas/mutations.ts src/lib/ventas/queries.ts "src/app/(app)/operaciones/facturacion/actions.ts"
git commit -m "feat(ventas): emit contado crea cobro + due_date, void bloquea con cobros, pendientes por balance"
```

---

## Task 9: Tests de integración (cobros + regresión)

**Files:**
- Create: `tests/cobros.test.ts`

**Prerequisito:** `npx supabase db reset` aplicado.

- [ ] **Step 1: Escribir los tests**

```typescript
import { describe, it, expect } from "vitest";
import { newUserClient } from "./setup";
import type { SaleSaveInput } from "@/lib/ventas/schema";
import { createDraft, emitSale, voidSale } from "@/lib/ventas/mutations";
import { registerPayment, voidPayment, setDueDate } from "@/lib/cobros/mutations";
import { listReceivablesByClient, getClientReceivable, listPayments } from "@/lib/cobros/queries";

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
async function makeClient(t: Awaited<ReturnType<typeof makeTenant>>, name: string) {
  const { data } = await t.client.from("clients").insert({ tenant_id: t.tenantId, kind: "person", name }).select("id").single();
  return data!.id as string;
}
const sale = (branchId: string, clientId: string | null, total = 100): SaleSaveInput => ({
  clientId, branchId, globalDiscountPct: 0, notes: undefined,
  items: [{ productId: null, description: "Prod", quantity: 1, unitPrice: total, discountPct: 0, taxRate: 0 }],
});
async function balanceOf(t: any, saleId: string) {
  const { data } = await t.client.from("sales").select("balance, paid_amount").eq("id", saleId).single();
  return { balance: Number(data.balance), paid: Number(data.paid_amount) };
}

describe("cobros — flujo con trigger", () => {
  it("emitir contado crea un cobro y deja la venta pagada", async () => {
    const a = await makeTenant("con");
    const id = await createDraft(a.client, a.tenantId, a.id, "USD", sale(await mainBranch(a), null, 100));
    await emitSale(a.client, id, { paymentType: "contado", paymentMethod: "efectivo" });
    expect((await balanceOf(a, id)).balance).toBe(0);
    const pays = await listPayments(a.client, id);
    expect(pays).toHaveLength(1);
    expect(pays[0].amount).toBe(100);
  });

  it("abono parcial baja el saldo; completar deja pagada; el trigger mantiene paid_amount", async () => {
    const a = await makeTenant("par");
    const cli = await makeClient(a, "Ana");
    const id = await createDraft(a.client, a.tenantId, a.id, "USD", sale(await mainBranch(a), cli, 100));
    await emitSale(a.client, id, { paymentType: "credito" });
    expect((await balanceOf(a, id)).balance).toBe(100);
    await registerPayment(a.client, a.tenantId, a.id, { saleId: id, amount: 40 });
    expect((await balanceOf(a, id)).balance).toBe(60);
    await registerPayment(a.client, a.tenantId, a.id, { saleId: id, amount: 60 });
    expect((await balanceOf(a, id)).balance).toBe(0);
  });

  it("un abono mayor al saldo es rechazado", async () => {
    const a = await makeTenant("ovr");
    const id = await createDraft(a.client, a.tenantId, a.id, "USD", sale(await mainBranch(a), null, 50));
    await emitSale(a.client, id, { paymentType: "credito" });
    await expect(registerPayment(a.client, a.tenantId, a.id, { saleId: id, amount: 51 })).rejects.toBeTruthy();
  });

  it("anular un cobro restaura el saldo (trigger)", async () => {
    const a = await makeTenant("vd");
    const id = await createDraft(a.client, a.tenantId, a.id, "USD", sale(await mainBranch(a), null, 100));
    await emitSale(a.client, id, { paymentType: "credito" });
    const pid = await registerPayment(a.client, a.tenantId, a.id, { saleId: id, amount: 100 });
    expect((await balanceOf(a, id)).balance).toBe(0);
    await voidPayment(a.client, pid);
    expect((await balanceOf(a, id)).balance).toBe(100);
  });

  it("no se puede anular una venta con cobros activos", async () => {
    const a = await makeTenant("blk");
    const id = await createDraft(a.client, a.tenantId, a.id, "USD", sale(await mainBranch(a), null, 100));
    await emitSale(a.client, id, { paymentType: "credito" });
    const pid = await registerPayment(a.client, a.tenantId, a.id, { saleId: id, amount: 30 });
    await expect(voidSale(a.client, id)).rejects.toBeTruthy();
    await voidPayment(a.client, pid);
    await voidSale(a.client, id); // ahora sí
  });
});

describe("cobros — Cuentas por Cobrar", () => {
  it("agrupa por cliente y calcula vencido con due_date en el pasado", async () => {
    const a = await makeTenant("cxc");
    const cli = await makeClient(a, "Zoe");
    const branch = await mainBranch(a);
    const id1 = await createDraft(a.client, a.tenantId, a.id, "USD", sale(branch, cli, 100));
    await emitSale(a.client, id1, { paymentType: "credito", dueDate: "2020-01-01" }); // vencida
    const id2 = await createDraft(a.client, a.tenantId, a.id, "USD", sale(branch, cli, 50));
    await emitSale(a.client, id2, { paymentType: "credito" }); // sin vencimiento

    const byClient = await listReceivablesByClient(a.client, {});
    const row = byClient.find((r) => r.clientId === cli);
    expect(row?.totalDue).toBe(150);
    expect(row?.overdueAmount).toBe(100);

    const soloVencidos = await listReceivablesByClient(a.client, { filter: "vencidos" });
    expect(soloVencidos.find((r) => r.clientId === cli)?.overdueAmount).toBe(100);

    const detail = await getClientReceivable(a.client, cli);
    expect(detail.totalDue).toBe(150);
    expect(detail.rows).toHaveLength(2);
    expect(detail.rows.find((r) => r.saleId === id1)?.overdue).toBe(true);
  });

  it("fijar vencimiento en una venta emitida", async () => {
    const a = await makeTenant("due");
    const id = await createDraft(a.client, a.tenantId, a.id, "USD", sale(await mainBranch(a), null, 100));
    await emitSale(a.client, id, { paymentType: "credito" });
    await setDueDate(a.client, id, "2027-06-30");
    const { data } = await a.client.from("sales").select("due_date").eq("id", id).single();
    expect(data!.due_date).toBe("2027-06-30");
  });
});
```

- [ ] **Step 2: Correr los tests — deben pasar**

Run: `npx vitest run tests/cobros.test.ts`
Expected: PASS (todos).

- [ ] **Step 3: Commit**

```bash
git add tests/cobros.test.ts
git commit -m "test(cobros): integración trigger + abonos + CxC + bloqueo de anulación"
```

---

## Task 10: Server Actions

**Files:**
- Create: `src/app/(app)/finanzas/cuentas-por-cobrar/actions.ts`

- [ ] **Step 1: Implementar**

```typescript
"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient as serverSupabase } from "@/lib/supabase/server";
import { paymentCreateSchema, dueDateSchema } from "@/lib/cobros/schema";
import { canRegisterPayment, canVoidPayment, canEditDueDate } from "@/lib/cobros/permissions";
import * as m from "@/lib/cobros/mutations";
import type { Role } from "@/lib/auth/roles";

export type FormState = { ok: boolean; error?: string; fieldErrors?: Record<string, string> };
const CXC = "/finanzas/cuentas-por-cobrar";

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

async function revalidateFor(sb: any, saleId: string, clientId?: string | null) {
  revalidatePath(CXC);
  revalidatePath(`/operaciones/facturacion/${saleId}`);
  revalidatePath("/dashboard");
  let cid = clientId;
  if (cid === undefined) {
    const { data } = await sb.from("sales").select("client_id").eq("id", saleId).maybeSingle();
    cid = data?.client_id ?? null;
  }
  if (cid) { revalidatePath(`${CXC}/${cid}`); revalidatePath(`/clientes/${cid}`); }
}

export async function registerPaymentAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { sb, userId, role, tenantId } = await ctx();
  if (!canRegisterPayment(role)) return { ok: false, error: "Sin permiso" };
  const parsed = paymentCreateSchema.safeParse({
    saleId: fd.get("saleId"), amount: fd.get("amount"), method: fd.get("method"),
    reference: fd.get("reference"), paidAt: fd.get("paidAt"), notes: fd.get("notes"),
  });
  if (!parsed.success) return { ok: false, fieldErrors: zodErrors(parsed.error) };
  try { await m.registerPayment(sb, tenantId, userId, parsed.data); }
  catch (e) { return { ok: false, error: (e as Error).message }; }
  await revalidateFor(sb, parsed.data.saleId);
  return { ok: true };
}

export async function voidPaymentAction(fd: FormData): Promise<void> {
  const { sb, role } = await ctx();
  if (!canVoidPayment(role)) return;
  const id = String(fd.get("id") ?? "");
  const saleId = String(fd.get("saleId") ?? "");
  await m.voidPayment(sb, id);
  await revalidateFor(sb, saleId);
}

export async function setDueDateAction(fd: FormData): Promise<void> {
  const { sb, role } = await ctx();
  if (!canEditDueDate(role)) return;
  const parsed = dueDateSchema.safeParse({ saleId: fd.get("saleId"), dueDate: fd.get("dueDate") });
  if (!parsed.success) return;
  await m.setDueDate(sb, parsed.data.saleId, parsed.data.dueDate);
  await revalidateFor(sb, parsed.data.saleId);
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/finanzas/cuentas-por-cobrar/actions.ts"
git commit -m "feat(cobros): Server Actions (registrar/anular abono, fijar vencimiento)"
```

---

## Task 11: Componentes CxC (table, card, toolbar, historial, vencimiento)

**Files:**
- Create: `src/components/cobros/receivables-table.tsx`, `receivable-row-card.tsx`, `receivables-toolbar.tsx`, `payments-history.tsx`, `due-date-field.tsx`

- [ ] **Step 1: receivables-table.tsx**

```tsx
import Link from "next/link";
import type { ReceivableClientRow } from "@/lib/cobros/queries";
import { formatMoney } from "@/lib/format";

export function ReceivablesTable({ rows, currency }: { rows: ReceivableClientRow[]; currency: string }) {
  return (
    <table className="hidden w-full text-sm lg:table">
      <thead>
        <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--text-soft)]">
          <th className="py-2 font-medium">Cliente</th><th className="font-medium">Total adeudado</th>
          <th className="font-medium">Vencido</th><th className="font-medium">Vto. más antiguo</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.clientId ?? "none"} className="border-b border-[var(--border)] hover:bg-[var(--bg)]">
            <td className="py-2.5">
              {r.clientId
                ? <Link href={`/finanzas/cuentas-por-cobrar/${r.clientId}`} className="font-medium text-[var(--text)] hover:text-[#0e7490]">{r.name}</Link>
                : <span className="text-[var(--text-soft)]">{r.name}</span>}
            </td>
            <td className="text-[var(--text)]">{formatMoney(r.totalDue, currency)}</td>
            <td className={r.overdueAmount > 0 ? "text-[#dc2626]" : "text-[var(--text-soft)]"}>{r.overdueAmount > 0 ? formatMoney(r.overdueAmount, currency) : "—"}</td>
            <td className="text-[var(--text-soft)]">{r.oldestDueDate ? new Date(r.oldestDueDate).toLocaleDateString("es-VE") : "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 2: receivable-row-card.tsx**

```tsx
import Link from "next/link";
import type { ReceivableClientRow } from "@/lib/cobros/queries";
import { formatMoney } from "@/lib/format";

export function ReceivableRowCard({ r, currency }: { r: ReceivableClientRow; currency: string }) {
  const inner = (
    <div className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 lg:hidden">
      <div className="min-w-0">
        <p className="truncate font-medium text-[var(--text)]">{r.name}</p>
        <p className="truncate text-xs text-[var(--text-soft)]">
          {formatMoney(r.totalDue, currency)}{r.overdueAmount > 0 ? ` · vencido ${formatMoney(r.overdueAmount, currency)}` : ""}
        </p>
      </div>
    </div>
  );
  return r.clientId ? <Link href={`/finanzas/cuentas-por-cobrar/${r.clientId}`}>{inner}</Link> : inner;
}
```

- [ ] **Step 3: receivables-toolbar.tsx**

```tsx
"use client";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

export function ReceivablesToolbar() {
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
        <input defaultValue={sp.get("q") ?? ""} placeholder="Buscar cliente…"
          onKeyDown={(e) => { if (e.key === "Enter") setParam("q", (e.target as HTMLInputElement).value); }}
          className="w-full bg-transparent text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-soft)]" />
      </div>
      <select className={sel} defaultValue={sp.get("filter") ?? "todos"} onChange={(e) => setParam("filter", e.target.value)}>
        <option value="todos">Todos</option>
        <option value="vencidos">Solo vencidos</option>
      </select>
    </div>
  );
}
```

- [ ] **Step 4: payments-history.tsx**

```tsx
import { formatMoney } from "@/lib/format";
import { voidPaymentAction } from "@/app/(app)/finanzas/cuentas-por-cobrar/actions";

type Payment = { id: string; amount: number; method: string | null; reference: string | null; paidAt: string; voided: boolean };

export function PaymentsHistory({ payments, saleId, currency, canVoid }: {
  payments: Payment[]; saleId: string; currency: string; canVoid: boolean;
}) {
  if (payments.length === 0) return <p className="text-sm text-[var(--text-soft)]">Sin cobros registrados.</p>;
  return (
    <ul className="divide-y divide-[var(--border)]">
      {payments.map((p) => (
        <li key={p.id} className={`flex items-center justify-between py-2 text-sm ${p.voided ? "opacity-50 line-through" : ""}`}>
          <span className="text-[var(--text)]">
            {formatMoney(p.amount, currency)}
            <span className="ml-2 text-xs text-[var(--text-soft)]">
              {new Date(p.paidAt).toLocaleDateString("es-VE")}{p.method ? ` · ${p.method}` : ""}{p.reference ? ` · ${p.reference}` : ""}
            </span>
          </span>
          {canVoid && !p.voided && (
            <form action={voidPaymentAction}>
              <input type="hidden" name="id" value={p.id} />
              <input type="hidden" name="saleId" value={saleId} />
              <button className="text-xs text-[var(--text-soft)] hover:text-[#dc2626]">Anular</button>
            </form>
          )}
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 5: due-date-field.tsx**

```tsx
import { setDueDateAction } from "@/app/(app)/finanzas/cuentas-por-cobrar/actions";

export function DueDateField({ saleId, dueDate, canEdit }: { saleId: string; dueDate: string | null; canEdit: boolean }) {
  const inputCls = "h-9 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text)] outline-none focus:border-[#0e7490]";
  if (!canEdit) return (
    <p className="text-sm"><span className="text-[var(--text-soft)]">Vencimiento: </span>
      <span className="text-[var(--text)]">{dueDate ? new Date(dueDate).toLocaleDateString("es-VE") : "—"}</span></p>
  );
  return (
    <form action={setDueDateAction} className="flex items-center gap-2">
      <input type="hidden" name="saleId" value={saleId} />
      <label className="text-sm text-[var(--text-soft)]">Vencimiento</label>
      <input type="date" name="dueDate" defaultValue={dueDate ?? ""} className={inputCls} />
      <button className="rounded-[10px] border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--text)]">Guardar</button>
    </form>
  );
}
```

- [ ] **Step 6: Verificar tipos + commit**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

```bash
git add src/components/cobros/receivables-table.tsx src/components/cobros/receivable-row-card.tsx src/components/cobros/receivables-toolbar.tsx src/components/cobros/payments-history.tsx src/components/cobros/due-date-field.tsx
git commit -m "feat(cobros): componentes CxC (tabla, card, toolbar, historial, vencimiento)"
```

---

## Task 12: Formulario de abono (panel inline)

**Files:**
- Create: `src/components/cobros/payment-form.tsx`

- [ ] **Step 1: Implementar**

```tsx
"use client";
import { useActionState, useEffect, useState } from "react";
import { registerPaymentAction, type FormState } from "@/app/(app)/finanzas/cuentas-por-cobrar/actions";
import { formatMoney } from "@/lib/format";

const initial: FormState = { ok: false };
const inputCls = "w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[#0e7490]";
const labelCls = "mb-1 block text-xs font-medium text-[var(--text-soft)]";

export function PaymentForm({ saleId, balance, currency }: { saleId: string; balance: number; currency: string }) {
  const [state, formAction, pending] = useActionState(registerPaymentAction, initial);
  const [open, setOpen] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const err = (k: string) => state.fieldErrors?.[k];

  // Tras un abono exitoso, colapsa el panel; el revalidatePath ya refrescó saldo/historial.
  useEffect(() => { if (state.ok) setOpen(false); }, [state]);

  if (!open) return (
    <button type="button" onClick={() => setOpen(true)}
      className="rounded-[10px] bg-gradient-to-br from-[#0e7490] to-[#14b8a6] px-3 py-2 text-sm font-semibold text-white">
      Registrar abono
    </button>
  );

  return (
    <form action={formAction} className="max-w-md space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <input type="hidden" name="saleId" value={saleId} />
      <p className="text-sm font-bold text-[var(--text)]">Registrar abono — saldo {formatMoney(balance, currency)}</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Monto</label>
          <input name="amount" type="number" step="0.01" min="0" max={balance} defaultValue={balance} className={inputCls} />
          {err("amount") && <p className="mt-1 text-xs text-[#dc2626]">{err("amount")}</p>}
        </div>
        <div>
          <label className={labelCls}>Fecha</label>
          <input name="paidAt" type="date" defaultValue={today} max={today} className={inputCls} />
          {err("paidAt") && <p className="mt-1 text-xs text-[#dc2626]">{err("paidAt")}</p>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={labelCls}>Método</label><input name="method" className={inputCls} placeholder="Efectivo, transferencia…" /></div>
        <div><label className={labelCls}>Referencia</label><input name="reference" className={inputCls} placeholder="Nº comprobante" /></div>
      </div>
      <div><label className={labelCls}>Notas</label><input name="notes" className={inputCls} /></div>
      {state.error && <p className="text-sm text-[#dc2626]">{state.error}</p>}
      <div className="flex gap-2">
        <button disabled={pending} className="rounded-[10px] bg-gradient-to-br from-[#0e7490] to-[#14b8a6] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
          {pending ? "Guardando…" : "Guardar abono"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-[10px] border border-[var(--border)] px-4 py-2.5 text-sm text-[var(--text)]">Cancelar</button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Verificar tipos + commit**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

```bash
git add src/components/cobros/payment-form.tsx
git commit -m "feat(cobros): formulario de abono (panel inline con validación de saldo)"
```

---

## Task 13: Páginas Cuentas por Cobrar (lista + estado de cuenta)

**Files:**
- Create: `src/app/(app)/finanzas/cuentas-por-cobrar/page.tsx` (reemplaza placeholder)
- Create: `src/app/(app)/finanzas/cuentas-por-cobrar/[clientId]/page.tsx`

- [ ] **Step 1: Lista (`page.tsx`)**

```tsx
import { redirect } from "next/navigation";
import { Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getTenantCurrency } from "@/lib/productos/queries";
import { listReceivablesByClient } from "@/lib/cobros/queries";
import { canRegisterPayment } from "@/lib/cobros/permissions";
import { formatMoney } from "@/lib/format";
import { ReceivablesToolbar } from "@/components/cobros/receivables-toolbar";
import { ReceivablesTable } from "@/components/cobros/receivables-table";
import { ReceivableRowCard } from "@/components/cobros/receivable-row-card";
import { EmptyState } from "@/components/shared/empty-state";
import type { Role } from "@/lib/auth/roles";

export default async function CuentasPorCobrarPage({ searchParams }: {
  searchParams: Promise<{ q?: string; filter?: string }>;
}) {
  const sp = await searchParams;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  const { data: mem } = await sb.from("memberships").select("role").eq("user_id", user!.id).single();
  const role = (mem?.role ?? "vendedor") as Role;
  if (!canRegisterPayment(role)) redirect("/dashboard");

  const filter = (sp.filter === "vencidos" ? "vencidos" : "todos") as "todos" | "vencidos";
  const [rows, currency] = await Promise.all([
    listReceivablesByClient(sb, { search: sp.q ?? "", filter }),
    getTenantCurrency(sb),
  ]);
  const totalDue = rows.reduce((s, r) => s + r.totalDue, 0);
  const overdue = rows.reduce((s, r) => s + r.overdueAmount, 0);

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-extrabold tracking-[-0.4px] text-[var(--text)]">Cuentas por cobrar</h1>
        <div className="text-sm text-[var(--text-soft)]">
          Total: <span className="font-semibold text-[var(--text)]">{formatMoney(totalDue, currency)}</span>
          {overdue > 0 && <> · Vencido: <span className="font-semibold text-[#dc2626]">{formatMoney(overdue, currency)}</span></>}
        </div>
      </div>

      <ReceivablesToolbar />

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
          <EmptyState icon={Wallet} title="Sin saldos pendientes" hint="Las ventas a crédito con saldo aparecen aquí." />
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-2 lg:p-4">
          <ReceivablesTable rows={rows} currency={currency} />
          <div className="space-y-2 lg:hidden">{rows.map((r) => <ReceivableRowCard key={r.clientId ?? "none"} r={r} currency={currency} />)}</div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Estado de cuenta (`[clientId]/page.tsx`)**

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTenantCurrency } from "@/lib/productos/queries";
import { getClientReceivable } from "@/lib/cobros/queries";
import { canRegisterPayment } from "@/lib/cobros/permissions";
import { formatMoney } from "@/lib/format";
import { PaymentForm } from "@/components/cobros/payment-form";
import type { Role } from "@/lib/auth/roles";

export default async function EstadoDeCuentaPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  const { data: mem } = await sb.from("memberships").select("role").eq("user_id", user!.id).single();
  const role = (mem?.role ?? "vendedor") as Role;
  if (!canRegisterPayment(role)) redirect("/dashboard");

  const [data, currency] = await Promise.all([getClientReceivable(sb, clientId), getTenantCurrency(sb)]);

  return (
    <div className="space-y-4 p-6">
      <Link href="/finanzas/cuentas-por-cobrar" className="text-sm text-[var(--text-soft)] hover:text-[#0e7490]">← Cuentas por cobrar</Link>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-extrabold tracking-[-0.4px] text-[var(--text)]">{data.clientName ?? "Cliente"}</h1>
        <div className="text-sm text-[var(--text-soft)]">
          Adeudado: <span className="font-semibold text-[var(--text)]">{formatMoney(data.totalDue, currency)}</span>
          {data.overdueAmount > 0 && <> · Vencido: <span className="font-semibold text-[#dc2626]">{formatMoney(data.overdueAmount, currency)}</span></>}
        </div>
      </div>

      {data.rows.length === 0 ? (
        <p className="text-sm text-[var(--text-soft)]">Sin saldos pendientes.</p>
      ) : (
        <div className="space-y-3">
          {data.rows.map((s) => (
            <div key={s.saleId} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <Link href={`/operaciones/facturacion/${s.saleId}`} className="font-medium text-[var(--text)] hover:text-[#0e7490]">Venta #{s.number}</Link>
                  <p className="text-xs text-[var(--text-soft)]">
                    Total {formatMoney(s.total, currency)} · Pagado {formatMoney(s.paid, currency)}
                    {s.dueDate ? ` · Vence ${new Date(s.dueDate).toLocaleDateString("es-VE")}` : ""}
                    {s.overdue ? " · VENCIDA" : ""}
                  </p>
                </div>
                <span className={`text-sm font-semibold ${s.overdue ? "text-[#dc2626]" : "text-[var(--text)]"}`}>Saldo {formatMoney(s.balance, currency)}</span>
              </div>
              <div className="mt-3"><PaymentForm saleId={s.saleId} balance={s.balance} currency={currency} /></div>
            </div>
          ))}
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
git add "src/app/(app)/finanzas/cuentas-por-cobrar/page.tsx" "src/app/(app)/finanzas/cuentas-por-cobrar/[clientId]/page.tsx"
git commit -m "feat(cobros): páginas Cuentas por Cobrar (lista + estado de cuenta)"
```

---

## Task 14: Detalle de venta enriquecido + vencimiento en el builder

**Files:**
- Modify: `src/app/(app)/operaciones/facturacion/[id]/page.tsx`
- Modify: `src/components/ventas/sale-builder.tsx`

- [ ] **Step 1: Vencimiento opcional en el panel de emisión (crédito)**

En `src/components/ventas/sale-builder.tsx`, dentro del panel de emisión, reemplazar el bloque del método de pago:

```tsx
          {paymentType === "contado" && (
            <div><label className={labelCls}>Método de pago (opcional)</label>
              <input name="paymentMethod" className={inputCls} placeholder="Efectivo, transferencia…" /></div>
          )}
```

por:

```tsx
          {paymentType === "contado" && (
            <div><label className={labelCls}>Método de pago (opcional)</label>
              <input name="paymentMethod" className={inputCls} placeholder="Efectivo, transferencia…" /></div>
          )}
          {paymentType === "credito" && (
            <div><label className={labelCls}>Fecha de vencimiento (opcional)</label>
              <input name="dueDate" type="date" className={inputCls} /></div>
          )}
```

- [ ] **Step 2: Detalle de venta — sección Cobros + gating del botón Anular**

Reemplazar TODO el contenido de `src/app/(app)/operaciones/facturacion/[id]/page.tsx` por:

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSale } from "@/lib/ventas/queries";
import { canVoidSale } from "@/lib/ventas/permissions";
import { getTenantCurrency } from "@/lib/productos/queries";
import { listPayments } from "@/lib/cobros/queries";
import { canRegisterPayment, canVoidPayment, canEditDueDate } from "@/lib/cobros/permissions";
import { deleteDraftAction, voidSaleAction } from "@/app/(app)/operaciones/facturacion/actions";
import { SaleDocument } from "@/components/ventas/sale-document";
import { PaymentsHistory } from "@/components/cobros/payments-history";
import { PaymentForm } from "@/components/cobros/payment-form";
import { DueDateField } from "@/components/cobros/due-date-field";
import type { Role } from "@/lib/auth/roles";

export default async function VentaDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createClient();
  const sale = await getSale(sb, id);
  if (!sale) notFound();
  const { data: { user } } = await sb.auth.getUser();
  const { data: mem } = await sb.from("memberships").select("role").eq("user_id", user!.id).single();
  const role = (mem?.role ?? "vendedor") as Role;

  const issued = sale.status === "issued";
  const balance = Number(sale.balance);
  const [payments, currency] = await Promise.all([
    issued ? listPayments(sb, id) : Promise.resolve([]),
    getTenantCurrency(sb),
  ]);
  const hasPayments = Number(sale.paid_amount) > 0;

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
          {issued && canVoidSale(role) && !hasPayments && (
            <form action={voidSaleAction}>
              <input type="hidden" name="id" value={sale.id} />
              <input type="hidden" name="clientId" value={sale.client_id ?? ""} />
              <button className="rounded-[10px] border border-[var(--border)] px-3 py-2 text-sm text-[#dc2626]">Anular</button>
            </form>
          )}
        </div>
      </div>

      <SaleDocument sale={sale as any} />

      {issued && (
        <div className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-bold text-[var(--text)]">Cobros</p>
            <DueDateField saleId={sale.id} dueDate={sale.due_date ?? null} canEdit={canEditDueDate(role)} />
          </div>
          <PaymentsHistory payments={payments} saleId={sale.id} currency={currency} canVoid={canVoidPayment(role)} />
          {balance > 0 && canRegisterPayment(role) && (
            <PaymentForm saleId={sale.id} balance={balance} currency={currency} />
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/operaciones/facturacion/[id]/page.tsx" src/components/ventas/sale-builder.tsx
git commit -m "feat(cobros): detalle de venta con sección Cobros + vencimiento en el builder"
```

---

## Task 15: Verificación final

**Files:** ninguno (solo verificación).

- [ ] **Step 1: Suite completa**

Run: `npx vitest run`
Expected: PASS todos (previos + `cobros` nuevos; ventas siguen verdes).

- [ ] **Step 2: Build de producción**

Run: `npm run build`
Expected: build exitoso, sin errores.

- [ ] **Step 3: E2E manual (checklist)**

`npm run dev`, como **owner**:
- Emitir una venta **a crédito** con fecha de vencimiento → detalle muestra saldo, sección Cobros vacía, vencimiento editable.
- **Registrar abono** parcial desde el detalle → saldo baja, aparece en el historial; registrar otro que completa → estado Pagada.
- **Anular** un cobro → el saldo vuelve a subir.
- Intentar **Anular la venta** con un cobro activo → el botón no aparece (hay que anular cobros); con saldo intacto (sin cobros) sí aparece.
- Emitir **contado** → detalle muestra un cobro por el total y saldo 0.
- **Cuentas por Cobrar** (`/finanzas/cuentas-por-cobrar`): lista por cliente con total y vencido; filtro "Solo vencidos"; entrar a un cliente → estado de cuenta con sus ventas y "Registrar abono".
- Detalle de **Cliente** (`/clientes/[id]`): "Por cobrar" refleja el saldo tras los abonos.

Role-gating (usuarios en `/configuracion/usuarios`):
- **vendedor/cajero:** `/finanzas/cuentas-por-cobrar` redirige a `/dashboard`; en el detalle de venta NO ven "Registrar abono" ni "Anular" cobro; **sí** pueden emitir contado (que crea el cobro).

- [ ] **Step 4: Commit final (si hubo ajustes)**

```bash
git add -A
git commit -m "chore(cobros): ajustes finales tras verificación E2E"
```

---

## Notas de cierre

- **DRY:** reusa `round2`, `formatMoney`, `getTenantCurrency`, `EmptyState`, patrón `ctx()`/`FormState`/`zodErrors`. No dupliques.
- **YAGNI:** nada de notas de crédito, recibos PDF, catálogo de métodos, límite de crédito ni multi-moneda (ver "Fuera de alcance" del spec).
- **Seguridad:** RLS aísla por tenant; `payments` es laxo para roles de venta (necesario para el contado) y la barrera de abonos manuales vive en `registerPaymentAction` (`canRegisterPayment` back-office); anular cobro es owner/admin en RLS. El trigger `recompute_sale_paid_amount` (SECURITY DEFINER) mantiene `paid_amount`; `balance` es columna generada.
- **PWA:** el formulario de abono es in-app (no `confirm`/`prompt`), coherente con la lección de diálogos nativos.
- **AGENTS.md:** Next.js custom; `params`/`searchParams` son Promises (por eso el `await`). Ante APIs de framework, consulta `node_modules/next/dist/docs/`.
- **Finish:** con la suite verde + build limpio, usar `superpowers:finishing-a-development-branch` para el merge a `master`.
```
